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

// Export functions globally
window.loadAllComplaints = loadAllComplaints;
window.filterAdminComplaints = filterAdminComplaints;
window.showUpdateModal = showUpdateModal;
window.updateComplaintStatus = updateComplaintStatus;
window.viewComplaintDetails = viewComplaintDetails;
window.runACOForComplaint = runACOForComplaint;
window.deleteTechnician = deleteTechnician;

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
    await loadTechniciansForSelect();
}

async function loadAllComplaints() {
    try {
        console.log('Loading all complaints for admin...');

        // First, check if there are any complaints at all
        const testSnapshot = await db.collection('complaints').limit(1).get();
        console.log('Complaints collection exists?', !testSnapshot.empty);

        const snapshot = await db.collection('complaints')
            .orderBy('createdAt', 'desc')
            .get();

        const complaints = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            complaints.push({
                id: doc.id,
                ...data,
                createdAt: data.createdAt
            });
        });

        console.log(`Found ${complaints.length} total complaints`);

        if (complaints.length === 0) {
            const container = document.getElementById('adminComplaintsList');
            if (container) {
                container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No complaints found. Students can submit complaints from their dashboard.</p></div>';
            }
        }

        updateAdminStats(complaints);
        displayAdminComplaints(complaints);

        return complaints;

    } catch (error) {
        console.error('Error loading complaints:', error);
        showToast('Error loading complaints: ' + error.message, 'error');
        return [];
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
        filtered = filtered.filter(c => (c.status || 'pending') === statusFilter);
    }
    if (priorityFilter !== 'all') {
        filtered = filtered.filter(c => (c.priority || 'low') === priorityFilter);
    }

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No complaints found</p></div>';
        return;
    }

    container.innerHTML = filtered.map(complaint => `
        <div class="complaint-card">
            <div class="complaint-header">
                <span class="complaint-id">#${complaint.id.slice(-6)}</span>
                <span class="complaint-priority priority-${complaint.priority || 'low'}">${(complaint.priority || 'low').toUpperCase()}</span>
                <span class="complaint-status status-${complaint.status || 'pending'}">${getStatusText(complaint.status || 'pending')}</span>
            </div>
            <div class="complaint-title">${escapeHtml(complaint.title || 'No Title')}</div>
            <div class="complaint-meta">
                <span><i class="fas fa-user"></i> ${escapeHtml(complaint.studentName || 'Unknown')}</span>
                <span><i class="fas fa-door-open"></i> ${complaint.studentRoom || 'N/A'}</span>
                <span><i class="fas fa-tag"></i> ${complaint.category || 'General'}</span>
                <span><i class="fas fa-calendar"></i> ${formatDate(complaint.createdAt)}</span>
                ${complaint.assignedToName ? `<span><i class="fas fa-wrench"></i> ${escapeHtml(complaint.assignedToName)}</span>` : ''}
            </div>
            <div class="complaint-description-preview">${escapeHtml((complaint.description || '').substring(0, 100))}${(complaint.description || '').length > 100 ? '...' : ''}</div>
            <div class="complaint-actions">
                <button class="btn btn-small" onclick="showUpdateModal('${complaint.id}')"><i class="fas fa-edit"></i> Update</button>
                <button class="btn btn-small" onclick="viewComplaintDetails('${complaint.id}')"><i class="fas fa-eye"></i> View</button>
                <button class="btn btn-small btn-primary" onclick="runACOForComplaint('${complaint.id}')"><i class="fas fa-robot"></i> ACO Assign</button>
            </div>
        </div>
    `).join('');
}

function filterAdminComplaints() {
    loadAllComplaints();
}

let currentComplaintToUpdate = null;

async function showUpdateModal(complaintId) {
    currentComplaintToUpdate = complaintId;
    const updateIdEl = document.getElementById('updateComplaintId');
    if (updateIdEl) updateIdEl.textContent = complaintId.slice(-6);

    // Load current complaint data
    try {
        const complaintDoc = await db.collection('complaints').doc(complaintId).get();
        const complaint = complaintDoc.data();

        const prioritySelect = document.getElementById('prioritySelect');
        if (prioritySelect && complaint.priority) {
            prioritySelect.value = complaint.priority;
        }

        const statusSelect = document.getElementById('newStatus');
        if (statusSelect && complaint.status) {
            statusSelect.value = complaint.status;
        }

        const assignSelect = document.getElementById('assignTechnicianSelect');
        if (assignSelect && complaint.assignedTo) {
            assignSelect.value = complaint.assignedTo;
        }

    } catch (error) {
        console.error('Error loading complaint data:', error);
    }

    const modal = document.getElementById('updateModal');
    if (modal) modal.style.display = 'flex';
}

async function loadTechniciansForSelect() {
    try {
        const snapshot = await db.collection('technicians').where('isActive', '==', true).get();
        const select = document.getElementById('assignTechnicianSelect');
        if (!select) return;

        select.innerHTML = '<option value="">Unassigned</option>';
        snapshot.forEach(doc => {
            const tech = doc.data();
            select.innerHTML += `<option value="${doc.id}">${escapeHtml(tech.name)} (${tech.specialization})</option>`;
        });
    } catch (error) {
        console.error('Error loading technicians for select:', error);
    }
}

async function runACOForComplaint(complaintId) {
    try {
        showToast('Running ACO optimization for this complaint...', 'info');

        const complaintDoc = await db.collection('complaints').doc(complaintId).get();
        const complaint = { id: complaintId, ...complaintDoc.data() };

        const techniciansSnapshot = await db.collection('technicians').where('isActive', '==', true).get();
        const technicians = [];
        techniciansSnapshot.forEach(doc => {
            technicians.push({ id: doc.id, ...doc.data(), currentWorkload: 0 });
        });

        if (technicians.length === 0) {
            showToast('No technicians available for assignment', 'error');
            return;
        }

        const taskSnapshot = await db.collection('tasks')
            .where('status', 'in', ['assigned', 'in-progress'])
            .get();

        taskSnapshot.forEach(doc => {
            const task = doc.data();
            const tech = technicians.find(t => t.id === task.technicianId);
            if (tech) tech.currentWorkload++;
        });

        const aco = new AntColonyOptimizer([complaint], technicians, acoConfig);
        const result = await aco.optimize();

        if (result && result.assignment && result.assignment[complaintId]) {
            const assignedTechId = result.assignment[complaintId];
            const assignedTech = technicians.find(t => t.id === assignedTechId);

            await db.collection('complaints').doc(complaintId).update({
                assignedTo: assignedTechId,
                assignedToName: assignedTech.name,
                assignedAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'assigned'
            });

            await db.collection('tasks').add({
                complaintId: complaintId,
                technicianId: assignedTechId,
                status: 'assigned',
                assignedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            await db.collection('notifications').add({
                userId: complaint.studentId,
                title: 'Complaint Assigned via ACO',
                message: `Your complaint "${complaint.title}" has been assigned to ${assignedTech.name} (${assignedTech.specialization})`,
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            showToast(`✅ Complaint assigned to ${assignedTech.name} via ACO`, 'success');
            loadAllComplaints();
        } else {
            showToast('ACO could not find a suitable technician', 'info');
        }

    } catch (error) {
        console.error('ACO assignment error:', error);
        showToast('Error running ACO: ' + error.message, 'error');
    }
}

async function updateComplaintStatus() {
    const newStatus = document.getElementById('newStatus').value;
    const newPriority = document.getElementById('prioritySelect').value;
    const assignedTo = document.getElementById('assignTechnicianSelect').value;
    const remarks = document.getElementById('adminRemarks').value;

    try {
        const updateData = {
            status: newStatus,
            priority: newPriority,
            adminRemarks: remarks,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            resolvedAt: newStatus === 'resolved' ? firebase.firestore.FieldValue.serverTimestamp() : null
        };

        if (assignedTo) {
            const techDoc = await db.collection('technicians').doc(assignedTo).get();
            if (techDoc.exists) {
                updateData.assignedTo = assignedTo;
                updateData.assignedToName = techDoc.data().name;
                updateData.assignedAt = firebase.firestore.FieldValue.serverTimestamp();
            }
        }

        await db.collection('complaints').doc(currentComplaintToUpdate).update(updateData);

        const complaintDoc = await db.collection('complaints').doc(currentComplaintToUpdate).get();
        const complaint = complaintDoc.data();

        if (complaint && complaint.studentId) {
            await db.collection('notifications').add({
                userId: complaint.studentId,
                title: `Complaint ${newStatus === 'resolved' ? 'Resolved' : 'Updated'}`,
                message: `Your complaint "${complaint.title}" status has been updated to ${newStatus}. Priority: ${newPriority.toUpperCase()}. ${remarks ? 'Remarks: ' + remarks : ''}`,
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        showToast('Complaint updated successfully', 'success');
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
        await loadTechniciansForSelect();

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
            await loadTechniciansForSelect();
        } catch (error) {
            console.error('Error deleting technician:', error);
            showToast('Error deleting technician: ' + error.message, 'error');
        }
    }
}

window.refreshAdminComplaints = function () {
    console.log('Manually refreshing admin complaints...');
    loadAllComplaints();
};