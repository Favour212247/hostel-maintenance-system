// Authentication Functions

let pendingAdminType = null;

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('studentRegisterForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await registerStudent();
        });
    }
    
    const loginForm = document.getElementById('studentLoginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await loginStudent();
        });
    }
    
    const adminPasswordInput = document.getElementById('adminPassword');
    if (adminPasswordInput) {
        adminPasswordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                verifyAdminLogin();
            }
        });
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('verified') === 'true') {
        showToast('Email verified! You can now login.', 'success');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});

function showAdminPasswordModal(adminType) {
    pendingAdminType = adminType;
    const adminNames = {
        'dsss': 'DSSS Office',
        'vc': 'VC Office',
        'warden': 'Hostel Warden'
    };
    document.getElementById('adminTypeDisplay').textContent = adminNames[adminType];
    document.getElementById('adminPassword').value = '';
    document.getElementById('adminPasswordModal').style.display = 'flex';
}

async function verifyAdminLogin() {
    const password = document.getElementById('adminPassword').value;
    
    if (!password) {
        showToast('Please enter the admin password', 'error');
        return;
    }
    
    const admin = ADMIN_CREDENTIALS[pendingAdminType];
    
    if (!admin) {
        showToast('Invalid admin type', 'error');
        return;
    }
    
    if (password === admin.password) {
        sessionStorage.setItem('currentUser', JSON.stringify({
            uid: `admin_${pendingAdminType}`,
            fullName: admin.name,
            role: admin.role,
            adminType: pendingAdminType,
            isAdmin: true
        }));
        
        showToast(`Welcome ${admin.name}`, 'success');
        closeModal('adminPasswordModal');
        
        setTimeout(() => {
            window.location.href = 'admin-dashboard.html';
        }, 500);
    } else {
        showToast('Invalid password. Access denied.', 'error');
        document.getElementById('adminPassword').value = '';
        document.getElementById('adminPassword').focus();
    }
}

async function registerStudent() {
    const fullName = document.getElementById('regFullName').value;
    const email = document.getElementById('regEmail').value;
    const studentId = document.getElementById('regStudentId').value;
    const hostelBlock = document.getElementById('regHostelBlock').value;
    const roomNumber = document.getElementById('regRoomNumber').value;
    const phone = document.getElementById('regPhone').value;
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    
    if (!fullName || !email || !studentId || !hostelBlock || !roomNumber || !password) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }
    
    if (!email.endsWith('.edu.ng') && !email.includes('@run.edu.ng')) {
        showToast('Please use your school email address', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        await db.collection('students').doc(user.uid).set({
            uid: user.uid,
            fullName: fullName,
            email: email,
            studentId: studentId,
            hostelBlock: hostelBlock,
            roomNumber: roomNumber,
            phone: phone || '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            role: 'student',
            emailVerified: false
        });
        
        await sendCustomEmailVerification(user, fullName);
        
        showToast('Registration successful! A verification link has been sent to your email. Please check your inbox and spam folder.', 'success');
        
        document.getElementById('studentRegisterForm').reset();
        
        setTimeout(() => {
            switchTab('login');
            showToast('Please verify your email before logging in', 'info');
        }, 2000);
        
    } catch (error) {
        console.error('Registration error:', error);
        if (error.code === 'auth/email-already-in-use') {
            showToast('Email already registered. Please login.', 'error');
        } else {
            showToast('Registration failed: ' + error.message, 'error');
        }
    } finally {
        showLoading(false);
    }
}

async function resendVerificationEmail() {
    const user = auth.currentUser;
    if (!user) {
        showToast('Please login first', 'error');
        return;
    }
    
    showLoading(true);
    try {
        await user.sendEmailVerification({
            url: window.location.origin + '/student-dashboard.html',
            handleCodeInApp: true
        });
        showToast('Verification email resent! Please check your inbox.', 'success');
    } catch (error) {
        console.error('Error resending email:', error);
        showToast('Error resending verification email: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function loginStudent(email = null, password = null) {
    if (!email) {
        email = document.getElementById('loginEmail').value;
        password = document.getElementById('loginPassword').value;
    }
    
    if (!email || !password) {
        showToast('Please enter email and password', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        await user.reload();
        
        // Comment out email verification for testing - UNCOMMENT FOR PRODUCTION
        /*
        if (!user.emailVerified) {
            await auth.signOut();
            showToast('Please verify your email before logging in. Check your inbox/spam folder.', 'error');
            
            setTimeout(() => {
                if (confirm('Need a new verification email? Click OK to resend.')) {
                    resendVerificationEmail();
                }
            }, 1000);
            return;
        }
        */
        
        const studentDoc = await db.collection('students').doc(user.uid).get();
        
        if (!studentDoc.exists) {
            await auth.signOut();
            showToast('Student record not found. Please contact support.', 'error');
            return;
        }
        
        const studentData = studentDoc.data();
        
        sessionStorage.setItem('currentUser', JSON.stringify({
            uid: user.uid,
            ...studentData,
            role: 'student'
        }));
        
        showToast('Login successful! Redirecting...', 'success');
        
        setTimeout(() => {
            window.location.href = 'student-dashboard.html';
        }, 1000);
        
    } catch (error) {
        console.error('Login error:', error);
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            showToast('Invalid email or password', 'error');
        } else if (error.code === 'auth/too-many-requests') {
            showToast('Too many attempts. Please try again later', 'error');
        } else {
            showToast('Login failed: ' + error.message, 'error');
        }
    } finally {
        showLoading(false);
    }
}

async function adminLogin(adminType) {
    showAdminPasswordModal(adminType);
}

async function logout() {
    try {
        await auth.signOut();
        sessionStorage.removeItem('currentUser');
        showToast('Logged out successfully', 'success');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 500);
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Error logging out', 'error');
    }
}

function switchTab(tab) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const tabs = document.querySelectorAll('.tab-btn');
    
    if (tab === 'login') {
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
        tabs[0].classList.add('active');
        tabs[1].classList.remove('active');
    } else {
        loginForm.classList.remove('active');
        registerForm.classList.add('active');
        tabs[0].classList.remove('active');
        tabs[1].classList.add('active');
    }
}

function getCurrentUser() {
    const userStr = sessionStorage.getItem('currentUser');
    return userStr ? JSON.parse(userStr) : null;
}

window.resendVerificationEmail = resendVerificationEmail;