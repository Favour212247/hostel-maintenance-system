// Main Utility Functions

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showLoading(show) {
    let loader = document.getElementById('globalLoader');
    
    if (!loader) {
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
            display: none;
            justify-content: center;
            align-items: center;
        `;
        loader.innerHTML = `<div class="spinner"><i class="fas fa-spinner fa-pulse fa-3x" style="color: white;"></i></div>`;
        document.body.appendChild(loader);
    }
    
    loader.style.display = show ? 'flex' : 'none';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

function setupTabs() {
    const menuItems = document.querySelectorAll('.sidebar-menu li');
    const tabMap = {
        'dashboard': 'dashboardTab',
        'new-complaint': 'newComplaintTab',
        'my-complaints': 'myComplaintsTab',
        'profile': 'profileTab',
        'complaints': 'dashboardTab',
        'students': 'studentsTab',
        'technicians': 'techniciansTab'
    };
    
    menuItems.forEach(item => {
        // Remove any existing event listeners by cloning
        const newItem = item.cloneNode(true);
        item.parentNode.replaceChild(newItem, item);
        
        newItem.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const tabName = this.getAttribute('data-tab');
            const tabId = tabMap[tabName];
            
            // Update active states
            document.querySelectorAll('.sidebar-menu li').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            
            // Show the selected tab content
            if (tabId) {
                document.querySelectorAll('.tab-content').forEach(tab => {
                    tab.classList.remove('active');
                });
                const activeTab = document.getElementById(tabId);
                if (activeTab) activeTab.classList.add('active');
            }
            
            // Load specific data based on tab
            if (tabName === 'profile' && typeof loadProfile === 'function') loadProfile();
            if (tabName === 'students' && typeof loadStudents === 'function') loadStudents();
            if (tabName === 'technicians' && typeof loadTechnicians === 'function') loadTechnicians();
        });
    });
}

function setupMobileMenu() {
    const toggleBtn = document.getElementById('mobileMenuToggle');
    const sidebar = document.getElementById('sidebar');
    
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            sidebar.classList.toggle('open');
        });
        
        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('open') && 
                !sidebar.contains(e.target) && 
                e.target !== toggleBtn) {
                sidebar.classList.remove('open');
            }
        });
    }
}

function initComplaintForm() {
    const form = document.getElementById('complaintForm');
    if (form) {
        form.removeEventListener('submit', submitComplaint);
        form.addEventListener('submit', submitComplaint);
    }
    
    const imageUpload = document.getElementById('complaintImage');
    const fileName = document.getElementById('fileName');
    if (imageUpload && fileName) {
        imageUpload.addEventListener('change', (e) => {
            fileName.textContent = e.target.files[0] ? e.target.files[0].name : 'No file chosen';
        });
    }
}

async function loadProfile() {
    const user = getCurrentUser();
    if (!user) return;
    
    const container = document.getElementById('profileInfo');
    if (!container) return;
    
    if (user.isAdmin) {
        container.innerHTML = `
            <div class="profile-field"><span class="profile-label">Name:</span><span class="profile-value">${escapeHtml(user.fullName)}</span></div>
            <div class="profile-field"><span class="profile-label">Role:</span><span class="profile-value">${user.role}</span></div>
            <div class="profile-field"><span class="profile-label">Admin Type:</span><span class="profile-value">${user.adminType ? user.adminType.toUpperCase() : 'Admin'}</span></div>
        `;
    } else {
        container.innerHTML = `
            <div class="profile-field"><span class="profile-label">Full Name:</span><span class="profile-value">${escapeHtml(user.fullName)}</span></div>
            <div class="profile-field"><span class="profile-label">Student ID:</span><span class="profile-value">${user.studentId || 'N/A'}</span></div>
            <div class="profile-field"><span class="profile-label">Email:</span><span class="profile-value">${user.email || 'N/A'}</span></div>
            <div class="profile-field"><span class="profile-label">Hostel Block:</span><span class="profile-value">${user.hostelBlock || 'N/A'}</span></div>
            <div class="profile-field"><span class="profile-label">Room Number:</span><span class="profile-value">${user.roomNumber || 'N/A'}</span></div>
            ${user.phone ? `<div class="profile-field"><span class="profile-label">Phone:</span><span class="profile-value">${user.phone}</span></div>` : ''}
        `;
    }
}

function initDashboard() {
    setupTabs();
    setupMobileMenu();
    initComplaintForm();
    
    const currentPage = window.location.pathname;
    
    if (currentPage.includes('student-dashboard')) {
        const user = getCurrentUser();
        if (user && !user.isAdmin) {
            const studentNameEl = document.getElementById('studentName');
            const studentRoomBadge = document.getElementById('studentRoomBadge');
            if (studentNameEl) studentNameEl.textContent = user.fullName || 'Student';
            if (studentRoomBadge) studentRoomBadge.textContent = `Room: ${user.roomNumber || '--'}`;
            
            if (typeof loadStudentComplaints === 'function') loadStudentComplaints();
            if (typeof loadProfile === 'function') loadProfile();
            
            // Real-time updates
            db.collection('complaints')
                .where('studentId', '==', user.uid)
                .onSnapshot(() => {
                    if (typeof loadStudentComplaints === 'function') loadStudentComplaints();
                });
        }
    } else if (currentPage.includes('admin-dashboard')) {
        if (typeof loadAdminDashboard === 'function') {
            loadAdminDashboard();
        }
        
        // Real-time updates for admin
        db.collection('complaints').onSnapshot(() => {
            if (typeof loadAllComplaints === 'function') {
                loadAllComplaints();
            }
        });
        
        db.collection('students').onSnapshot(() => {
            if (typeof loadStudents === 'function') {
                loadStudents();
            }
        });
        
        db.collection('technicians').onSnapshot(() => {
            if (typeof loadTechnicians === 'function') {
                loadTechnicians();
            }
        });
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    if (timestamp.toDate) {
        return timestamp.toDate().toLocaleDateString();
    }
    return new Date(timestamp).toLocaleDateString();
}

document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
});

// Global function exports
window.submitComplaint = submitComplaint;
window.submitEmergency = submitEmergency;
window.filterComplaints = filterComplaints;
window.showNewComplaintForm = showNewComplaintForm;
window.showDashboardTab = showDashboardTab;
window.closeModal = closeModal;
window.showUpdateModal = showUpdateModal;
window.updateComplaintStatus = updateComplaintStatus;
window.viewComplaintDetails = viewComplaintDetails;
window.filterAdminComplaints = filterAdminComplaints;
window.switchTab = switchTab;
window.logout = logout;
window.adminLogin = adminLogin;
window.showEmergencyForm = showEmergencyForm;
window.showAddTechnicianModal = showAddTechnicianModal;
window.addTechnician = addTechnician;
window.deleteTechnician = deleteTechnician;
window.saveAcoConfig = saveAcoConfig;
window.runManualAllocation = runManualAllocation;
window.escapeHtml = escapeHtml;
window.formatDate = formatDate;
window.getCurrentUser = getCurrentUser;

// Debug function
window.debugCheckComplaints = async function() {
    console.log('=== DEBUG: Checking Complaints ===');
    try {
        const snapshot = await db.collection('complaints').get();
        console.log(`Total complaints in Firestore: ${snapshot.size}`);
        
        snapshot.forEach(doc => {
            const data = doc.data();
            console.log(`- ${doc.id}: ${data.title} (${data.status}) - Student: ${data.studentName}`);
        });
        
        const user = getCurrentUser();
        if (user && !user.isAdmin) {
            const userSnapshot = await db.collection('complaints')
                .where('studentId', '==', user.uid)
                .get();
            console.log(`Complaints for current student (${user.uid}): ${userSnapshot.size}`);
        }
        
        return snapshot.size;
    } catch (error) {
        console.error('Debug error:', error);
        return 0;
    }
};

console.log('Debug function available: type debugCheckComplaints() in console');