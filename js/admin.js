// Admin Dashboard Functions

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('admin-dashboard.html')) {
        loadAdminDashboard();
        setupTabs();
        setupMobileMenu();
    }
});

async function loadAdminDashboard() {
    const user = getCurrentUser();
    if (!user || !user.isAdmin) {
        window.location.href = 'index.html';
        return;
    }
    
    document.getElementById('adminName').textContent = user.fullName;
    document.getElementById('adminRole').textContent = user.role;
    
    await loadAllComplaints();
    await loadStudents();
    await loadTechnicians();
}

async function loadAllComplaints() {
    try {
        const snapshot = await db.collection('complaints').orderBy('createdAt', 'desc').get();
        const complaints = [];
        snapshot.forEach(doc => {
            complaints.push({ id: doc.id, ...doc.data() });
        });
        
        updateAdminStats(complaints);
        displayAdminComplaints(complaints);
        
    } catch (error) {
        console.error('Error loading complaints:', error);
        showToast('Error loading complaints', 'error');
    }
}

function updateAdminStats(complaints) {
    const total = complaints.length;
    const pending = complaints.filter(c => c.status === 'pending').length;
    const inProgress = complaints.filter(c => c.status === 'in-progress' || c.status === 'assigned').length;
    const resolved = complaints.filter(c => c.status === 'resolved').length;
    
    document.getElementById('totalComplaints').textContent = total;
    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('inProgressCount').textContent = inProgress;
    document.getElementById('resolvedCount').textContent = resolved;
}

function displayAdminComplaints(complaints) {
    const container = document.getElementById('adminComplaintsList');
    if (!container) return;
    
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
                <span><i class="fas fa-door-open"></i> ${complaint.studentRoom}</span>
                <span><i class="fas fa-tag"></i> ${complaint.category}</span>
                <span><i class="fas fa-calendar"></i> ${formatDate(complaint.createdAt)}</span>
                <span class="complaint-status status-${complaint.status}">${getStatusText(complaint.status)}</span>
            </div>
            <div class="complaint-description-preview">${escapeHtml(complaint.description.substring(0, 100))}${complaint.description.length > 100 ? '...' : ''}</div>
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
    document.getElementById('updateComplaintId').textContent = complaintId.slice(-6);
    document.getElementById('updateModal').style.display = 'flex';
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
        
        // Get complaint details for notification
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
        document.getElementById('adminRemarks').value = '';
        loadAllComplaints();
        
    } catch (error) {
        console.error('Error updating complaint:', error);
        showToast('Error updating complaint', 'error');
    }
}

async function loadStudents() {
    try {
        const snapshot = await db.collection('students').orderBy('createdAt', 'desc').get();
        const students = [];
        snapshot.forEach(doc => {
            students.push({ id: doc.id, ...doc.data() });
        });
        
        document.getElementById('totalStudents').textContent = students.length;
        
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
                    <small>${student.studentId} | ${student.hostelBlock} - ${student.roomNumber}</small><br>
                    <small>${student.email}</small>
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
                    <small>${tech.specialization} | Zone ${tech.zone}</small><br>
                    <small>📞 ${tech.phone || 'No phone'}</small>
                </div>
                <div>
                    <button class="btn btn-small btn-danger" onclick="deleteTechnician('${tech.id}')"><i class="fas fa-trash"></i> Remove</button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading technicians:', error);
    }
}

function showAddTechnicianModal() {
    document.getElementById('addTechnicianModal').style.display = 'flex';
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
            phone: phone,
            zone: zone,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            isActive: true
        });
        
        showToast('Technician added successfully', 'success');
        closeModal('addTechnicianModal');
        
        document.getElementById('techName').value = '';
        document.getElementById('techPhone').value = '';
        
        loadTechnicians();
        
    } catch (error) {
        console.error('Error adding technician:', error);
        showToast('Error adding technician', 'error');
    }
}

async function deleteTechnician(techId) {
    if (confirm('Are you sure you want to remove this technician?')) {
        try {
            await db.collection('technicians').doc(techId).delete();
            showToast('Technician removed', 'success');
            loadTechnicians();
        } catch (error) {
            console.error('Error deleting technician:', error);
            showToast('Error deleting technician', 'error');
        }
    }
}