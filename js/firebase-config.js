// ========================================
// FIREBASE CONFIGURATION
// ========================================

const firebaseConfig = {
  apiKey: "AIzaSyDBGMUJuribiUT-ygHrUAuHoVHjVKB0Wxo",
  authDomain: "complaint-portal-79dad.firebaseapp.com",
  databaseURL: "https://complaint-portal-79dad-default-rtdb.firebaseio.com",
  projectId: "complaint-portal-79dad",
  storageBucket: "complaint-portal-79dad.firebasestorage.app",
  messagingSenderId: "832574034608",
  appId: "1:832574034608:web:e49258dfbbd7bbab20a175",
  measurementId: "G-LBPT4880N2"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence
db.enablePersistence()
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.log('Multiple tabs open, persistence enabled in first tab only');
        } else if (err.code == 'unimplemented') {
            console.log('Browser doesn\'t support offline persistence');
        }
    });

// Admin Credentials with secure passwords
const ADMIN_CREDENTIALS = {
    dsss: { 
        username: "dsss_admin", 
        password: "DSSS@2024Secure!", 
        name: "DSSS Administrator", 
        role: "DSSS Office", 
        adminType: "dsss" 
    },
    vc: { 
        username: "vc_admin", 
        password: "VC@2024Secure!", 
        name: "Vice Chancellor", 
        role: "VC Office", 
        adminType: "vc" 
    },
    warden: { 
        username: "warden_admin", 
        password: "Warden@2024Secure!", 
        name: "Hostel Warden", 
        role: "Hostel Warden", 
        adminType: "warden" 
    }
};

// Global variables for ACO
let acoConfig = {
    numAnts: 20,
    alpha: 1.0,
    beta: 2.0,
    rho: 0.5,
    q: 100,
    iterations: 50
};

// Load saved ACO config from localStorage
function loadAcoConfig() {
    const saved = localStorage.getItem('acoConfig');
    if (saved) {
        try {
            acoConfig = JSON.parse(saved);
        } catch(e) {
            console.error('Error loading ACO config:', e);
        }
    }
}

function saveAcoConfigToLocal() {
    localStorage.setItem('acoConfig', JSON.stringify(acoConfig));
}

loadAcoConfig();

// ========== FIXED: Auth state handler - separates admin from students ==========
auth.onAuthStateChanged(async (user) => {
    const currentPage = window.location.pathname;
    const sessionUser = sessionStorage.getItem('currentUser');
    const isAdminRoute = currentPage.includes('admin-dashboard.html');
    
    // For admin routes, check session storage only
    if (isAdminRoute) {
        if (!sessionUser || !JSON.parse(sessionUser).isAdmin) {
            window.location.href = 'index.html';
        }
        return;
    }
    
    // For student routes, handle Firebase user
    if (user) {
        // Skip email verification check for students on index page
        if (currentPage.includes('index.html') || currentPage === '/' || currentPage === '') {
            const sessionUserData = sessionStorage.getItem('currentUser');
            if (sessionUserData) {
                const userData = JSON.parse(sessionUserData);
                if (userData.isAdmin) {
                    window.location.href = 'admin-dashboard.html';
                } else {
                    window.location.href = 'student-dashboard.html';
                }
            }
            return;
        }
        
        // For student dashboard, check email verification (optional - comment out for testing)
        if (currentPage.includes('student-dashboard.html')) {
            await user.reload();
            
            // Comment out for testing - uncomment for production
            /*
            if (!user.emailVerified) {
                await auth.signOut();
                sessionStorage.removeItem('currentUser');
                showToast('Please verify your email before accessing the dashboard', 'error');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
                return;
            }
            */
            
            // Update user record in Firestore
            const userRef = db.collection('students').doc(user.uid);
            const userDoc = await userRef.get();
            
            if (userDoc.exists) {
                await userRef.update({
                    emailVerified: true,
                    verifiedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        }
    } else {
        // User is not logged in
        if (!currentPage.includes('index.html') && currentPage !== '/' && currentPage !== '') {
            sessionStorage.removeItem('currentUser');
            window.location.href = 'index.html';
        }
    }
});

// Handle email verification
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const oobCode = urlParams.get('oobCode');
    
    if (mode === 'verifyEmail' && oobCode) {
        handleEmailVerification(oobCode);
    }
});

async function handleEmailVerification(oobCode) {
    showLoading(true);
    try {
        await auth.applyActionCode(oobCode);
        
        const user = auth.currentUser;
        if (user) {
            await user.reload();
            
            if (user.emailVerified) {
                await db.collection('students').doc(user.uid).update({
                    emailVerified: true,
                    verifiedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                const studentDoc = await db.collection('students').doc(user.uid).get();
                if (studentDoc.exists) {
                    sessionStorage.setItem('currentUser', JSON.stringify({
                        uid: user.uid,
                        ...studentDoc.data(),
                        role: 'student'
                    }));
                }
                
                showToast('Email verified successfully! Redirecting to dashboard...', 'success');
                
                setTimeout(() => {
                    window.location.href = 'student-dashboard.html';
                }, 2000);
            }
        } else {
            showToast('Email verified! Please login to continue.', 'success');
            setTimeout(() => {
                window.location.href = 'index.html?verified=true';
            }, 1500);
        }
    } catch (error) {
        console.error('Verification error:', error);
        showToast('Verification failed. Please try again or contact support.', 'error');
    } finally {
        showLoading(false);
    }
}

async function sendCustomEmailVerification(user, fullName) {
    try {
        const actionCodeSettings = {
            url: window.location.origin + '/student-dashboard.html',
            handleCodeInApp: true
        };
        
        await user.sendEmailVerification(actionCodeSettings);
        
        await db.collection('emailVerifications').doc(user.uid).set({
            email: user.email,
            fullName: fullName,
            sentAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'pending'
        });
        
        console.log('Verification email sent to:', user.email);
    } catch (error) {
        console.error('Error sending verification email:', error);
        await user.sendEmailVerification();
    }
}

// Export functions
window.sendCustomEmailVerification = sendCustomEmailVerification;
window.handleEmailVerification = handleEmailVerification;