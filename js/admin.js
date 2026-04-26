// Admin Dashboard Functions

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('admin-dashboard.html')) {
        setTimeout(() => {
            loadAdminDashboard();
            setupTabs();
            setupMobileMenu();
        }, 100);
    }
});

async function loadAdminDashboard() {
    const user = getCurrentUser();
    if (!user || !user.isAdmin) {
        console.log('No admin user found, redirecting to login');
        window.location.href = 'index.html';
        return;
    }
    
    const adminNameEl = document.getElementById('adminName');
    const adminRoleEl = document.getElementById('adminRole');
    
    if (adminNameEl) adminNameEl.textContent = user.fullName;
    if (adminRoleEl) adminRoleEl.textContent = user.role;
    
    console.log('Admin dashboard loaded for:', user.fullName);
    
    await loadAllComplaints();
    await loadStudents();
    await loadTechnicians();
}

async function loadAllComplaints() {
    try {
        console.log('Loading all complaints for admin...');
        
        const snapshot = await db.collection('complaints')
            .orderBy('createdAt', 'desc')
            .get();
        
        const complaints = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            complaints.push({ 
                id: doc.id, 
                ...data,
                createdAt: data.createdAt || firebase.firestore.Timestamp.now()
            });
        });
        
        console.log(`Found ${complaints.length} total complaints`);
        
        updateAdminStats(complaints);
        displayAdminComplaints(complaints);
        
    } catch (error) {
        console.error('Error loading complaints:', error);
        showToast('Error loading complaints: ' + error.message, 'error');
    }
}

function updateAdminStats(complaints) {
    const total = complaints.length;
    const pending = complaints.filter(c => c.status === 'pending' || c.status === 'unassigned').length;
    const inProgress = complaints.filter(c => c.status === 'in-progress' || c.status === 'assigned').length;
    const resolved = complaints.filter(c => c.status === 'resolved').length;
    
    const totalEl = document.getElementById('totalComplaints');
    const pendingEl = document.getElementById('pendingCount');
    const inProgressEl = document.getElementById('inProgressCount');
    const resolvedEl = document.getElementById('resolvedCount');
    
    if (totalEl) totalEl.textContent = total;
    if (pendingEl) pendingEl.textContent = pending;
    if (inProgressEl) inProgressEl.textContent = inProgress;
    if (resolvedEl) resolvedEl.textContent = resolved;
}

function displayAdminComplaints(complaints) {
    const container = document.getElementById('adminComplaintsList');
    if (!container) {
        console.log('Container adminComplaintsList not found');
        return;
    }
    
    const statusFilter = document.getElementById('statusFilter')?.value || 'all';
    const priorityFilter = document.getElementById('priorityFilter')?.value || 'all';
    
    let filtered = complaints;
    
    if (statusFilter !== 'all') {
        filtered = filtered.filter(c => c.status === statusFilter);
    }
    if (priorityFilter !== 'all') {
        filtered = filtered.filter(c => c.priority === priorityFilter);
    }
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No complaints found</p></div>';
        return;
    }
    
    container.innerHTML = filtered.map(complaint => `
        <div class="complaint-card">
            <div class="complaint-header">
                <span class="complaint-id">#${complaint.id.slice(-6)}</span>
                <span class="complaint-priority priority-${complaint.priority}">${complaint.priority.toUpperCase()}</span>
            </div>
            <div class="complaint-title">${escapeHtml(complaint.title)}</div>
            <div class="complaint-meta">
                <span><i class="fas fa-user"></i> ${escapeHtml(complaint.studentName)}</span>
                <span><i class="fas fa-door-open"></i> ${complaint.studentRoom || 'N/A'}</span>
                <span><i class="fas fa-tag"></i> ${complaint.category}</span>
                <span><i class="fas fa-calendar"></i> ${formatDate(complaint.createdAt)}</span>
                <span class="complaint-status status-${complaint.status}">${getStatusText(complaint.status)}</span>
            </div>
            <div class="complaint-description-preview">${escapeHtml((complaint.description || '').substring(0, 100))}${(complaint.description || '').length > 100 ? '...' : ''}</div>
            <div class="complaint-actions">
                <button class="btn btn-small" onclick="showUpdateModal('${complaint.id}')"><i class="fas fa-edit"></i> Update</button>
                <button class="btn btn-small" onclick="viewComplaintDetails('${complaint.id}')"><i class="fas fa-eye"></i> View</button>
            </div>
        </div>
    `).join('');
}

function filterAdminComplaints() {
    loadAllComplaints();
}

let currentComplaintToUpdate = null;

function showUpdateModal(complaintId) {
    currentComplaintToUpdate = complaintId;
    const updateIdEl = document.getElementById('updateComplaintId');
    if (updateIdEl) updateIdEl.textContent = complaintId.slice(-6);
    
    const modal = document.getElementById('updateModal');
    if (modal) modal.style.display = 'flex';
}

async function updateComplaintStatus() {
    const newStatus = document.getElementById('newStatus').value;
    const remarks = document.getElementById('adminRemarks').value;
    
    try {
        await db.collection('complaints').doc(currentComplaintToUpdate).update({
            status: newStatus,
            adminRemarks: remarks,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            resolvedAt: newStatus === 'resolved' ? firebase.firestore.FieldValue.serverTimestamp() : null
        });
        
        const complaintDoc = await db.collection('complaints').doc(currentComplaintToUpdate).get();
        const complaint = complaintDoc.data();
        
        if (complaint && complaint.studentId) {
            await db.collection('notifications').add({
                userId: complaint.studentId,
                title: `Complaint ${newStatus === 'resolved' ? 'Resolved' : 'Updated'}`,
                message: `Your complaint "${complaint.title}" status has been updated to ${newStatus}. ${remarks ? 'Remarks: ' + remarks : ''}`,
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        showToast('Complaint status updated successfully', 'success');
        closeModal('updateModal');
        
        const remarksInput = document.getElementById('adminRemarks');
        if (remarksInput) remarksInput.value = '';
        
        await loadAllComplaints();
        
        if (typeof loadStudentComplaints === 'function') {
            loadStudentComplaints();
        }
        
    } catch (error) {
        console.error('Error updating complaint:', error);
        showToast('Error updating complaint: ' + error.message, 'error');
    }
}

async function loadStudents() {
    try {
        const snapshot = await db.collection('students').orderBy('createdAt', 'desc').get();
        const students = [];
        snapshot.forEach(doc => {
            students.push({ id: doc.id, ...doc.data() });
        });
        
        const totalStudentsEl = document.getElementById('totalStudents');
        if (totalStudentsEl) totalStudentsEl.textContent = students.length;
        
        const container = document.getElementById('studentsList');
        if (!container) return;
        
        if (students.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>No students registered</p></div>';
            return;
        }
        
        container.innerHTML = students.map(student => `
            <div class="student-card">
                <div>
                    <strong>${escapeHtml(student.fullName)}</strong><br>
                    <small>${student.studentId || 'N/A'} | ${student.hostelBlock || 'N/A'} - ${student.roomNumber || 'N/A'}</small><br>
                    <small>${student.email || 'N/A'}</small>
                </div>
                <div>
                    <span class="badge">Registered: ${formatDate(student.createdAt)}</span>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading students:', error);
        showToast('Error loading students', 'error');
    }
}

async function loadTechnicians() {
    try {
        const snapshot = await db.collection('technicians').get();
        const technicians = [];
        snapshot.forEach(doc => {
            technicians.push({ id: doc.id, ...doc.data() });
        });
        
        const container = document.getElementById('techniciansList');
        if (!container) return;
        
        if (technicians.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-wrench"></i><p>No technicians added yet</p></div>';
            return;
        }
        
        container.innerHTML = technicians.map(tech => `
            <div class="technician-card">
                <div>
                    <strong>${escapeHtml(tech.name)}</strong><br>
                    <small>${tech.specialization || 'General'} | Zone ${tech.zone || 'A'}</small><br>
                    <small>📞 ${tech.phone || 'No phone'}</small>
                </div>
                <div>
                    <button class="btn btn-small btn-danger" onclick="deleteTechnician('${tech.id}')"><i class="fas fa-trash"></i> Remove</button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading technicians:', error);
        showToast('Error loading technicians', 'error');
    }
}

function showAddTechnicianModal() {
    const modal = document.getElementById('addTechnicianModal');
    if (modal) modal.style.display = 'flex';
}

async function addTechnician() {
    const name = document.getElementById('techName').value;
    const specialization = document.getElementById('techSpecialization').value;
    const phone = document.getElementById('techPhone').value;
    const zone = document.getElementById('techZone').value;
    
    if (!name || !specialization || !zone) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    try {
        await db.collection('technicians').add({
            name: name,
            specialization: specialization,
            phone: phone || '',
            zone: zone,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            isActive: true
        });
        
        showToast('Technician added successfully', 'success');
        closeModal('addTechnicianModal');
        
        const techNameInput = document.getElementById('techName');
        const techPhoneInput = document.getElementById('techPhone');
        
        if (techNameInput) techNameInput.value = '';
        if (techPhoneInput) techPhoneInput.value = '';
        
        await loadTechnicians();
        
    } catch (error) {
        console.error('Error adding technician:', error);
        showToast('Error adding technician: ' + error.message, 'error');
    }
}

async function deleteTechnician(techId) {
    if (confirm('Are you sure you want to remove this technician?')) {
        try {
            await db.collection('technicians').doc(techId).delete();
            showToast('Technician removed', 'success');
            await loadTechnicians();
        } catch (error) {
            console.error('Error deleting technician:', error);
            showToast('Error deleting technician: ' + error.message, 'error');
        }
    }
}

window.refreshAdminComplaints = function() {
    console.log('Manually refreshing admin complaints...');
    loadAllComplaints();
};