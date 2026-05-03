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
        } catch (e) {
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

    console.log('Auth state changed:', {
        user: user?.email,
        currentPage,
        isAdminRoute,
        hasSession: !!sessionUser
    });

    // For admin routes, check session storage only
    if (isAdminRoute) {
        if (!sessionUser || !JSON.parse(sessionUser).isAdmin) {
            console.log('No admin session, redirecting to index');
            window.location.href = 'index.html';
        }
        return;
    }

    // For student dashboard
    if (currentPage.includes('student-dashboard.html')) {
        if (!user) {
            // No Firebase user, redirect to login
            console.log('No Firebase user, redirecting to index');
            sessionStorage.removeItem('currentUser');
            window.location.href = 'index.html';
            return;
        }

        try {
            // Check if we have student data in Firestore
            const studentDoc = await db.collection('students').doc(user.uid).get();

            if (!studentDoc.exists) {
                console.error('Student record not found for user:', user.uid);
                await auth.signOut();
                sessionStorage.removeItem('currentUser');
                if (typeof showToast === 'function') {
                    showToast('Student record not found. Please register again.', 'error');
                } else {
                    alert('Student record not found. Please register again.');
                }
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
                return;
            }

            // Update session storage with latest student data
            const studentData = studentDoc.data();
            sessionStorage.setItem('currentUser', JSON.stringify({
                uid: user.uid,
                ...studentData,
                role: 'student'
            }));

            console.log('Student session updated:', studentData.fullName);

            // If we're on student dashboard but session user is not set, reload to trigger dashboard init
            const sessionCheck = sessionStorage.getItem('currentUser');
            if (!sessionCheck) {
                console.log('Session not set, reloading page');
                location.reload();
            }
        } catch (error) {
            console.error('Error checking student record:', error);
            if (typeof showToast === 'function') {
                showToast('Error loading student data: ' + error.message, 'error');
            }
        }
    }

    // For index page, redirect if already logged in
    if (currentPage.includes('index.html') || currentPage === '/' || currentPage === '') {
        if (sessionUser) {
            try {
                const userData = JSON.parse(sessionUser);
                if (userData.isAdmin) {
                    console.log('Redirecting admin to admin dashboard');
                    window.location.href = 'admin-dashboard.html';
                } else if (user) {
                    console.log('Redirecting student to student dashboard');
                    window.location.href = 'student-dashboard.html';
                }
            } catch (e) {
                console.error('Error parsing session user:', e);
            }
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
    if (typeof showLoading === 'function') showLoading(true);
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

                if (typeof showToast === 'function') {
                    showToast('Email verified successfully! Redirecting to dashboard...', 'success');
                } else {
                    alert('Email verified successfully! Redirecting to dashboard...');
                }

                setTimeout(() => {
                    window.location.href = 'student-dashboard.html';
                }, 2000);
            }
        } else {
            if (typeof showToast === 'function') {
                showToast('Email verified! Please login to continue.', 'success');
            } else {
                alert('Email verified! Please login to continue.');
            }
            setTimeout(() => {
                window.location.href = 'index.html?verified=true';
            }, 1500);
        }
    } catch (error) {
        console.error('Verification error:', error);
        if (typeof showToast === 'function') {
            showToast('Verification failed. Please try again or contact support.', 'error');
        } else {
            alert('Verification failed. Please try again or contact support.');
        }
    } finally {
        if (typeof showLoading === 'function') showLoading(false);
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
        // Fallback to default email verification
        await user.sendEmailVerification();
    }
}

// Helper function for toast (fallback if main.js hasn't loaded)
if (typeof window.showToast === 'undefined') {
    window.showToast = function (message, type) {
        console.log(`Toast [${type}]: ${message}`);
        // Try to use the main showToast if available
        if (typeof showToast === 'function') {
            showToast(message, type);
        }
    };
}

// Export functions
window.sendCustomEmailVerification = sendCustomEmailVerification;
window.handleEmailVerification = handleEmailVerification;
window.ADMIN_CREDENTIALS = ADMIN_CREDENTIALS;
window.acoConfig = acoConfig;
window.saveAcoConfigToLocal = saveAcoConfigToLocal;
window.loadAcoConfig = loadAcoConfig;