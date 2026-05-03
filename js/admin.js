// Admin Dashboard Functions with Email Notifications

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('admin-dashboard.html')) {
        setTimeout(() => {
            loadAdminDashboard();
            setupTabs();
            setupMobileMenu();
        }, 100);
    }
});

// Google Apps Script URL for email notifications
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz8M5XXQ2w8SamyORGAlFhC9PT2n3l7bj1E7xQKdlCkKh4YQ4RWo6k0J1P6S417uNBqSg/exec';

// Export functions globally
window.loadAllComplaints = loadAllComplaints;
window.filterAdminComplaints = filterAdminComplaints;
window.showUpdateModal = showUpdateModal;
window.updateComplaintStatus = updateComplaintStatus;
window.viewComplaintDetails = viewComplaintDetails;
window.runACOForComplaint = runACOForComplaint;
window.deleteTechnician = deleteTechnician;
window.addTechnician = addTechnician;
window.showAddTechnicianModal = showAddTechnicianModal;

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

        const snapshot = await db.collection('complaints').get();

        const complaints = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            complaints.push({
                id: doc.id,
                ...data,
                createdAt: data.createdAt
            });
        });

        // Sort manually
        complaints.sort((a, b) => {
            const dateA = a.createdAt?.toDate?.() || new Date(0);
            const dateB = b.createdAt?.toDate?.() || new Date(0);
            return dateB - dateA;
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
            select.innerHTML += `<option value="${doc.id}">${escapeHtml(tech.name)} (${tech.specialization}) - ${tech.email || 'No email'}</option>`;
        });
    } catch (error) {
        console.error('Error loading technicians for select:', error);
    }
}

// ========================================
// EMAIL NOTIFICATION FUNCTION
// ========================================

async function sendEmailToTechnician(technician, complaint, complaintId) {
    try {
        console.log(`Sending email to ${technician.name} (${technician.email})`);

        const emailData = {
            technicianEmail: technician.email,
            technicianName: technician.name,
            technicianPhone: technician.phone || '',
            complaintId: complaintId.slice(-6),
            complaintTitle: complaint.title,
            priority: complaint.priority,
            studentName: complaint.studentName,
            roomNumber: complaint.studentRoom,
            hostelBlock: complaint.hostelBlock,
            category: complaint.category,
            description: complaint.description,
            createdAt: new Date().toLocaleString()
        };

        // Send to Google Apps Script
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(emailData)
        });

        console.log(`✅ Email sent successfully to ${technician.email}`);

        // Log to Firestore
        await db.collection('emailLogs').add({
            technicianId: technician.id,
            technicianEmail: technician.email,
            technicianName: technician.name,
            complaintId: complaintId,
            complaintTitle: complaint.title,
            priority: complaint.priority,
            sentAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'sent'
        });

        return true;

    } catch (error) {
        console.error('❌ Email sending failed:', error);

        await db.collection('emailLogs').add({
            technicianId: technician.id,
            technicianEmail: technician.email,
            complaintId: complaintId,
            error: error.message,
            sentAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'failed'
        });

        return false;
    }
}

// ========================================
// ACO ASSIGNMENT WITH EMAIL NOTIFICATION
// ========================================

async function runACOForComplaint(complaintId) {
    try {
        showToast('🔄 Running ACO optimization...', 'info');

        const complaintDoc = await db.collection('complaints').doc(complaintId).get();
        const complaint = { id: complaintId, ...complaintDoc.data() };

        const techniciansSnapshot = await db.collection('technicians').where('isActive', '==', true).get();
        const technicians = [];
        techniciansSnapshot.forEach(doc => {
            const tech = doc.data();
            technicians.push({ id: doc.id, ...tech, currentWorkload: 0 });
        });

        if (technicians.length === 0) {
            showToast('No technicians available', 'error');
            return;
        }

        // Get current workloads
        const taskSnapshot = await db.collection('tasks')
            .where('status', 'in', ['assigned', 'in-progress'])
            .get();

        taskSnapshot.forEach(doc => {
            const task = doc.data();
            const tech = technicians.find(t => t.id === task.technicianId);
            if (tech) tech.currentWorkload++;
        });

        // Run ACO algorithm
        const aco = new AntColonyOptimizer([complaint], technicians, acoConfig);
        const result = await aco.optimize();

        if (result && result.assignment && result.assignment[complaintId]) {
            const assignedTechId = result.assignment[complaintId];
            const assignedTech = technicians.find(t => t.id === assignedTechId);

            // Update complaint with assigned technician
            await db.collection('complaints').doc(complaintId).update({
                assignedTo: assignedTechId,
                assignedToName: assignedTech.name,
                assignedAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'assigned'
            });

            // Create task record
            await db.collection('tasks').add({
                complaintId: complaintId,
                technicianId: assignedTechId,
                status: 'assigned',
                assignedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // SEND EMAIL NOTIFICATION TO TECHNICIAN
            let emailSent = false;
            if (assignedTech.email) {
                emailSent = await sendEmailToTechnician(assignedTech, complaint, complaintId);
                if (emailSent) {
                    showToast(`✅ Assigned to ${assignedTech.name} - Email sent!`, 'success');
                } else {
                    showToast(`⚠️ Assigned to ${assignedTech.name} but email failed`, 'warning');
                }
            } else {
                showToast(`⚠️ Assigned to ${assignedTech.name} - No email address on file`, 'warning');
            }

            // Notify student
            await db.collection('notifications').add({
                userId: complaint.studentId,
                title: 'Complaint Assigned',
                message: `Your complaint "${complaint.title}" has been assigned to ${assignedTech.name}. ${emailSent ? 'They have been notified by email.' : 'Please check back for updates.'}`,
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            loadAllComplaints();
        } else {
            showToast('ACO could not find a suitable technician', 'info');
        }

    } catch (error) {
        console.error('ACO error:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

// ========================================
// MANUAL ASSIGNMENT WITH EMAIL NOTIFICATION
// ========================================

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

        let assignedTech = null;

        if (assignedTo) {
            const techDoc = await db.collection('technicians').doc(assignedTo).get();
            if (techDoc.exists) {
                assignedTech = { id: techDoc.id, ...techDoc.data() };
                updateData.assignedTo = assignedTo;
                updateData.assignedToName = assignedTech.name;
                updateData.assignedAt = firebase.firestore.FieldValue.serverTimestamp();
            }
        }

        await db.collection('complaints').doc(currentComplaintToUpdate).update(updateData);

        // Send email if assigning to technician and status is assigned/in-progress
        if (assignedTech && assignedTech.email && (newStatus === 'assigned' || newStatus === 'in-progress')) {
            const complaintDoc = await db.collection('complaints').doc(currentComplaintToUpdate).get();
            const complaint = complaintDoc.data();
            await sendEmailToTechnician(assignedTech, complaint, currentComplaintToUpdate);
            showToast(`✅ Email sent to ${assignedTech.name}`, 'success');
        }

        // Notify student
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

        showToast('Complaint updated successfully', 'success');
        closeModal('updateModal');

        document.getElementById('adminRemarks').value = '';
        await loadAllComplaints();

        if (typeof loadStudentComplaints === 'function') {
            loadStudentComplaints();
        }

    } catch (error) {
        console.error('Error updating complaint:', error);
        showToast('Error updating complaint: ' + error.message, 'error');
    }
}

// ========================================
// TECHNICIAN MANAGEMENT WITH EMAIL FIELD
// ========================================

async function loadStudents() {
    try {
        console.log('Loading students...');

        const snapshot = await db.collection('students').get();

        const students = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            students.push({
                id: doc.id,
                ...data,
                createdAt: data.createdAt
            });
        });

        students.sort((a, b) => {
            const dateA = a.createdAt?.toDate?.() || new Date(0);
            const dateB = b.createdAt?.toDate?.() || new Date(0);
            return dateB - dateA;
        });

        const container = document.getElementById('studentsList');
        if (!container) return;

        if (students.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>No students registered yet.</p></div>';
            return;
        }

        container.innerHTML = students.map(student => `
            <div class="student-card">
                <div>
                    <strong>${escapeHtml(student.fullName || 'No Name')}</strong><br>
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
        showToast('Error loading students: ' + error.message, 'error');
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
                    <small>📧 ${tech.email || 'No email'}</small><br>
                    <small>🔧 ${tech.specialization || 'General'} | Zone ${tech.zone || 'A'}</small><br>
                    <small>📞 ${tech.phone || 'No phone'}</small>
                </div>
                <div>
                    <button class="btn btn-small btn-danger" onclick="deleteTechnician('${tech.id}')"><i class="fas fa-trash"></i> Remove</button>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading technicians:', error);
        showToast('Error loading technicians: ' + error.message, 'error');
    }
}

function showAddTechnicianModal() {
    const modal = document.getElementById('addTechnicianModal');
    if (modal) modal.style.display = 'flex';
}

async function addTechnician() {
    const name = document.getElementById('techName').value;
    const email = document.getElementById('techEmail').value;
    const specialization = document.getElementById('techSpecialization').value;
    const phone = document.getElementById('techPhone').value;
    const zone = document.getElementById('techZone').value;

    if (!name || !email || !specialization || !zone) {
        showToast('Please fill all required fields (Name, Email, Specialization, Zone)', 'error');
        return;
    }

    // Basic email validation
    if (!email.includes('@')) {
        showToast('Please enter a valid email address', 'error');
        return;
    }

    try {
        await db.collection('technicians').add({
            name: name,
            email: email,
            specialization: specialization,
            phone: phone || '',
            zone: zone,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            isActive: true
        });

        showToast(`✅ Technician ${name} added successfully`, 'success');
        closeModal('addTechnicianModal');

        // Clear form
        document.getElementById('techName').value = '';
        document.getElementById('techEmail').value = '';
        document.getElementById('techPhone').value = '';

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

function getStatusText(status) {
    const statusMap = {
        'pending': 'Pending',
        'assigned': 'Assigned',
        'in-progress': 'In Progress',
        'resolved': 'Resolved',
        'unassigned': 'Unassigned'
    };
    return statusMap[status] || status;
}

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    if (timestamp.toDate) {
        return timestamp.toDate().toLocaleString();
    }
    return new Date(timestamp).toLocaleString();
}

window.refreshAdminComplaints = function () {
    console.log('Manually refreshing admin complaints...');
    loadAllComplaints();
};