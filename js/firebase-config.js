// ========================================
// FIREBASE CONFIGURATION
// HOSTEL COMPLAINT SYSTEM
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

// Enable offline persistence for better performance
db.enablePersistence()
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.log('Multiple tabs open, persistence enabled in first tab only');
        } else if (err.code == 'unimplemented') {
            console.log('Browser doesn\'t support offline persistence');
        } else {
            console.log('Persistence error:', err);
        }
    });

// ========================================
// ADMIN CREDENTIALS
// ========================================

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

// ========================================
// ACO (ANT COLONY OPTIMIZATION) CONFIGURATION
// ========================================

let acoConfig = {
    numAnts: 20,        // Number of ants in the colony
    alpha: 1.0,         // Pheromone importance factor
    beta: 2.0,          // Heuristic importance factor
    rho: 0.5,           // Pheromone evaporation rate
    q: 100,             // Pheromone deposit amount
    iterations: 50      // Number of iterations to run
};

// Load saved ACO config from localStorage
function loadAcoConfig() {
    const saved = localStorage.getItem('acoConfig');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            acoConfig = { ...acoConfig, ...parsed };
            console.log('ACO config loaded from localStorage:', acoConfig);
        } catch (e) {
            console.error('Error loading ACO config:', e);
        }
    }
}

// Save ACO config to localStorage
function saveAcoConfigToLocal() {
    localStorage.setItem('acoConfig', JSON.stringify(acoConfig));
    console.log('ACO config saved to localStorage');
}

// Load config on startup
loadAcoConfig();

// ========================================
// EMAIL NOTIFICATION CONFIGURATION
// ========================================

// Google Apps Script URL for email notifications
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz8M5XXQ2w8SamyORGAlFhC9PT2n3l7bj1E7xQKdlCkKh4YQ4RWo6k0J1P6S417uNBqSg/exec';

// Email log collection name
const EMAIL_LOGS_COLLECTION = 'emailLogs';

// ========================================
// AUTH STATE HANDLER
// ========================================

auth.onAuthStateChanged(async (user) => {
    const currentPage = window.location.pathname;
    const sessionUser = sessionStorage.getItem('currentUser');
    const isAdminRoute = currentPage.includes('admin-dashboard.html');
    const isTechnicianRoute = currentPage.includes('technician-dashboard.html');

    console.log('Auth state changed:', {
        user: user?.email,
        currentPage,
        isAdminRoute,
        isTechnicianRoute,
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

    // For technician routes (if implemented)
    if (isTechnicianRoute) {
        const technicianUser = sessionStorage.getItem('technicianUser');
        if (!technicianUser) {
            console.log('No technician session, redirecting to login');
            window.location.href = 'technician-login.html';
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

// ========================================
// EMAIL VERIFICATION FUNCTIONS
// ========================================

// Handle email verification from URL
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
                // Update student record
                await db.collection('students').doc(user.uid).update({
                    emailVerified: true,
                    verifiedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                // Get student data
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

        // Store verification record
        await db.collection('emailVerifications').doc(user.uid).set({
            email: user.email,
            fullName: fullName,
            sentAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'pending'
        });

        console.log('Verification email sent to:', user.email);
        return true;

    } catch (error) {
        console.error('Error sending verification email:', error);

        // Fallback to default email verification
        try {
            await user.sendEmailVerification();
            return true;
        } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
            return false;
        }
    }
}

// ========================================
// EMAIL LOGGING FUNCTIONS
// ========================================

async function logEmailSent(technician, complaint, complaintId, status = 'sent', error = null) {
    try {
        const logData = {
            technicianId: technician.id,
            technicianEmail: technician.email,
            technicianName: technician.name,
            complaintId: complaintId,
            complaintTitle: complaint.title,
            priority: complaint.priority,
            status: status,
            sentAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (error) {
            logData.error = error;
        }

        await db.collection(EMAIL_LOGS_COLLECTION).add(logData);
        console.log(`Email log recorded: ${status} for ${technician.email}`);

    } catch (error) {
        console.error('Error logging email:', error);
    }
}

// ========================================
// HELPER FUNCTIONS
// ========================================

// Toast notification fallback
if (typeof window.showToast === 'undefined') {
    window.showToast = function (message, type) {
        console.log(`Toast [${type}]: ${message}`);

        // Try to find existing toast or create one
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.className = 'toast';
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.className = `toast ${type} show`;

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    };
}

// Loading indicator fallback
if (typeof window.showLoading === 'undefined') {
    window.showLoading = function (show) {
        let loader = document.getElementById('globalLoader');

        if (!loader && show) {
            loader = document.createElement('div');
            loader.id = 'globalLoader';
            loader.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                z-index: 9999;
                display: flex;
                justify-content: center;
                align-items: center;
            `;
            loader.innerHTML = '<div class="spinner"><i class="fas fa-spinner fa-pulse fa-3x" style="color: white;"></i></div>';
            document.body.appendChild(loader);
        }

        if (loader) {
            loader.style.display = show ? 'flex' : 'none';
        }
    };
}

// ========================================
// EXPORT FUNCTIONS (Global)
// ========================================

window.ADMIN_CREDENTIALS = ADMIN_CREDENTIALS;
window.acoConfig = acoConfig;
window.GOOGLE_SCRIPT_URL = GOOGLE_SCRIPT_URL;
window.sendCustomEmailVerification = sendCustomEmailVerification;
window.handleEmailVerification = handleEmailVerification;
window.saveAcoConfigToLocal = saveAcoConfigToLocal;
window.loadAcoConfig = loadAcoConfig;
window.logEmailSent = logEmailSent;

// ========================================
// INITIALIZATION LOG
// ========================================

console.log('✅ Firebase initialized successfully');
console.log('📧 Email notifications enabled with Google Apps Script');
console.log('🐜 ACO configuration loaded:', acoConfig);
console.log('👥 Admin credentials loaded for DSSS, VC, and Warden');
console.log('📊 Firestore persistence enabled');

// Optional: Create emailLogs collection index hint
console.log('ℹ️ For optimal performance, create Firestore index on emailLogs: sentAt DESC');