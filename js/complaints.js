// Complaint Management Functions

let currentStudentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    const complaintForm = document.getElementById('complaintForm');
    if (complaintForm) {
        complaintForm.removeEventListener('submit', submitComplaint);
        complaintForm.addEventListener('submit', submitComplaint);
    }
    
    if (window.location.pathname.includes('student-dashboard.html')) {
        setTimeout(() => {
            loadStudentComplaints();
        }, 500);
    }
});

async function loadStudentComplaints() {
    currentStudentUser = getCurrentUser();
    
    if (!currentStudentUser || currentStudentUser.isAdmin) {
        console.log('No student user found or user is admin');
        return;
    }
    
    console.log('Loading complaints for student:', currentStudentUser.uid);
    
    try {
        const complaintsSnapshot = await db.collection('complaints')
            .where('studentId', '==', currentStudentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();
        
        const complaints = [];
        complaintsSnapshot.forEach(doc => {
            const data = doc.data();
            complaints.push({ 
                id: doc.id, 
                ...data,
                createdAt: data.createdAt || firebase.firestore.Timestamp.now()
            });
        });
        
        console.log(`Found ${complaints.length} complaints for student`);
        
        updateStudentStats(complaints);
        displayRecentComplaints(complaints.slice(0, 5));
        displayAllComplaints(complaints);
        
    } catch (error) {
        console.error('Error loading complaints:', error);
        showToast('Error loading complaints: ' + error.message, 'error');
    }
}

function updateStudentStats(complaints) {
    const pending = complaints.filter(c => c.status === 'pending' || c.status === 'unassigned').length;
    const inProgress = complaints.filter(c => c.status === 'in-progress' || c.status === 'assigned').length;
    const resolved = complaints.filter(c => c.status === 'resolved').length;
    
    const pendingEl = document.getElementById('pendingCount');
    const inProgressEl = document.getElementById('inProgressCount');
    const resolvedEl = document.getElementById('resolvedCount');
    
    if (pendingEl) pendingEl.textContent = pending;
    if (inProgressEl) inProgressEl.textContent = inProgress;
    if (resolvedEl) resolvedEl.textContent = resolved;
}

function displayRecentComplaints(complaints) {
    const container = document.getElementById('recentComplaintsList');
    if (!container) return;
    
    if (complaints.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No complaints yet. Submit your first complaint!</p></div>';
        return;
    }
    
    container.innerHTML = complaints.map(complaint => `
        <div class="complaint-card">
            <div class="complaint-header">
                <span class="complaint-id">#${complaint.id.slice(-6)}</span>
                <span class="complaint-priority priority-${complaint.priority}">${complaint.priority.toUpperCase()}</span>
            </div>
            <div class="complaint-title">${escapeHtml(complaint.title)}</div>
            <div class="complaint-meta">
                <span><i class="fas fa-calendar"></i> ${formatDate(complaint.createdAt)}</span>
                <span><i class="fas fa-tag"></i> ${complaint.category}</span>
                <span class="complaint-status status-${complaint.status}">${getStatusText(complaint.status)}</span>
            </div>
            <div class="complaint-actions">
                <button class="btn btn-small" onclick="viewComplaintDetails('${complaint.id}')"><i class="fas fa-eye"></i> View Details</button>
            </div>
        </div>
    `).join('');
}

function displayAllComplaints(complaints) {
    const container = document.getElementById('allComplaintsList');
    if (!container) return;
    
    const filter = document.getElementById('complaintFilter')?.value || 'all';
    let filtered = complaints;
    
    if (filter !== 'all') {
        filtered = complaints.filter(c => c.status === filter);
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
                <span><i class="fas fa-calendar"></i> ${formatDate(complaint.createdAt)}</span>
                <span><i class="fas fa-tag"></i> ${complaint.category}</span>
                <span class="complaint-status status-${complaint.status}">${getStatusText(complaint.status)}</span>
            </div>
            <div class="complaint-actions">
                <button class="btn btn-small" onclick="viewComplaintDetails('${complaint.id}')"><i class="fas fa-eye"></i> View Details</button>
            </div>
        </div>
    `).join('');
}

function filterComplaints() {
    loadStudentComplaints();
}

async function submitComplaint(event) {
    if (event) event.preventDefault();
    
    const category = document.getElementById('complaintCategory').value;
    const title = document.getElementById('complaintTitle').value;
    const description = document.getElementById('complaintDescription').value;
    
    if (!category || !title || !description) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    const autoPriority = detectAutoPriority(title, description, category);
    const autoRouting = determineAutoRouting(autoPriority, category, description);
    
    const imageFile = document.getElementById('complaintImage')?.files[0];
    
    const user = getCurrentUser();
    if (!user || user.isAdmin) {
        showToast('Please login as a student', 'error');
        return;
    }
    
    const confirmMessage = `🔍 SYSTEM ANALYSIS RESULTS:\n\n` +
        `📋 Issue: ${title}\n` +
        `🏷️ Category: ${category}\n\n` +
        `⚡ Detected Priority: ${getPriorityDisplay(autoPriority)}\n` +
        `📍 Will be sent to: ${getRoutingDisplay(autoRouting)}\n\n` +
        `Click OK to submit complaint.`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    showLoading(true);
    
    try {
        let imageDataUrl = null;
        if (imageFile) {
            imageDataUrl = await readFileAsDataURL(imageFile);
        }
        
        const complaintData = {
            studentId: user.uid,
            studentName: user.fullName,
            studentEmail: user.email,
            studentRoom: user.roomNumber,
            hostelBlock: user.hostelBlock,
            category: category,
            title: title,
            description: description,
            priority: autoPriority,
            status: 'pending',
            directToAdmin: autoRouting === 'dsss' || autoRouting === 'dsss_vc',
            autoDetected: true,
            detectionScore: autoPriority,
            routingTo: autoRouting,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            imageDataUrl: imageDataUrl
        };
        
        console.log('Submitting complaint:', complaintData);
        
        const docRef = await db.collection('complaints').add(complaintData);
        
        console.log('Complaint saved with ID:', docRef.id);
        
        const notificationTitle = autoRouting === 'dsss_vc' ? 
            '🚨 EMERGENCY COMPLAINT - IMMEDIATE ACTION 🚨' : 
            'New Complaint Submitted';
        
        await db.collection('notifications').add({
            title: notificationTitle,
            message: `${user.fullName} (${user.roomNumber}) submitted a ${autoPriority.toUpperCase()} priority complaint: ${title.substring(0, 80)}`,
            type: autoPriority === 'emergency' ? 'emergency' : 'new_complaint',
            complaintId: docRef.id,
            routingTo: autoRouting,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        if (autoPriority !== 'emergency' && typeof allocateComplaint === 'function') {
            const newComplaint = { id: docRef.id, ...complaintData, zone: user.hostelBlock ? user.hostelBlock.charAt(0) : 'A' };
            await allocateComplaint(newComplaint);
        }
        
        const sentTo = getRoutingDisplay(autoRouting);
        const sentToDisplay = document.getElementById('sentToDisplay');
        if (sentToDisplay) sentToDisplay.textContent = sentTo;
        
        const successModal = document.getElementById('successModal');
        if (successModal) successModal.style.display = 'flex';
        
        const complaintForm = document.getElementById('complaintForm');
        if (complaintForm) complaintForm.reset();
        
        const fileNameSpan = document.getElementById('fileName');
        if (fileNameSpan) fileNameSpan.textContent = 'No file chosen';
        
        showToast(`✅ Complaint submitted! Priority: ${autoPriority.toUpperCase()}`, 'success');
        
        setTimeout(() => {
            loadStudentComplaints();
        }, 1500);
        
        if (typeof loadAllComplaints === 'function') {
            setTimeout(() => {
                loadAllComplaints();
            }, 2000);
        }
        
    } catch (error) {
        console.error('Error submitting complaint:', error);
        showToast('Error submitting complaint: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function viewComplaintDetails(complaintId) {
    try {
        const doc = await db.collection('complaints').doc(complaintId).get();
        if (!doc.exists) {
            showToast('Complaint not found', 'error');
            return;
        }
        
        const complaint = { id: doc.id, ...doc.data() };
        
        const detailsHtml = `
            <div class="complaint-details">
                <p><strong>Complaint ID:</strong> #${complaint.id.slice(-6)}</p>
                <p><strong>Title:</strong> ${escapeHtml(complaint.title)}</p>
                <p><strong>Category:</strong> ${complaint.category}</p>
                <p><strong>Priority:</strong> <span class="complaint-priority priority-${complaint.priority}">${complaint.priority.toUpperCase()}</span></p>
                ${complaint.autoDetected ? `<p><strong>Auto-Detected:</strong> Yes (System analyzed content)</p>` : ''}
                <p><strong>Status:</strong> <span class="complaint-status status-${complaint.status}">${getStatusText(complaint.status)}</span></p>
                <p><strong>Description:</strong> ${escapeHtml(complaint.description)}</p>
                <p><strong>Submitted:</strong> ${formatDate(complaint.createdAt)}</p>
                ${complaint.assignedToName ? `<p><strong>Assigned To:</strong> ${escapeHtml(complaint.assignedToName)}</p>` : ''}
                ${complaint.adminRemarks ? `<p><strong>Admin Remarks:</strong> ${escapeHtml(complaint.adminRemarks)}</p>` : ''}
                ${complaint.imageDataUrl ? `<p><strong>Attached Image:</strong></p><img src="${complaint.imageDataUrl}" style="max-width: 100%; border-radius: 8px; margin-top: 10px;">` : ''}
            </div>
        `;
        
        const modal = document.getElementById('viewModal');
        const detailsDiv = document.getElementById('complaintDetails');
        if (detailsDiv) detailsDiv.innerHTML = detailsHtml;
        if (modal) modal.style.display = 'flex';
        
    } catch (error) {
        console.error('Error viewing complaint:', error);
        showToast('Error loading complaint details', 'error');
    }
}

async function submitEmergency() {
    const issue = document.getElementById('emergencyIssue').value;
    
    if (!issue.trim()) {
        showToast('Please describe the emergency issue', 'error');
        return;
    }
    
    const user = getCurrentUser();
    if (!user || user.isAdmin) {
        showToast('Please login as a student', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        const complaintData = {
            studentId: user.uid,
            studentName: user.fullName,
            studentEmail: user.email,
            studentRoom: user.roomNumber,
            hostelBlock: user.hostelBlock,
            category: 'emergency',
            title: 'EMERGENCY ISSUE - Immediate Attention Required',
            description: issue,
            priority: 'emergency',
            status: 'pending',
            directToAdmin: true,
            isEmergency: true,
            autoDetected: true,
            routingTo: 'dsss_vc',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        const docRef = await db.collection('complaints').add(complaintData);
        
        await db.collection('notifications').add({
            title: '🚨 EMERGENCY COMPLAINT 🚨',
            message: `${user.fullName} from ${user.roomNumber} reported an emergency: ${issue.substring(0, 100)}`,
            type: 'emergency',
            complaintId: docRef.id,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showToast('Emergency complaint sent to DSSS/VC!', 'success');
        closeModal('emergencyModal');
        
        setTimeout(() => {
            showDashboardTab();
            loadStudentComplaints();
            if (typeof loadAllComplaints === 'function') {
                loadAllComplaints();
            }
        }, 1500);
        
    } catch (error) {
        console.error('Error submitting emergency:', error);
        showToast('Error submitting emergency complaint: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function showEmergencyForm() {
    const modal = document.getElementById('emergencyModal');
    if (modal) modal.style.display = 'flex';
}

function showNewComplaintForm() {
    const menuItems = document.querySelectorAll('.sidebar-menu li');
    menuItems.forEach((item, index) => {
        if (index === 1) item.click();
    });
}

function showDashboardTab() {
    const menuItems = document.querySelectorAll('.sidebar-menu li');
    menuItems.forEach((item, index) => {
        if (index === 0) item.click();
    });
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

window.refreshComplaints = function() {
    console.log('Manually refreshing complaints...');
    loadStudentComplaints();
    if (typeof loadAllComplaints === 'function') {
        loadAllComplaints();
    }
};