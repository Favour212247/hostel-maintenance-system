// ========================================
// ANT COLONY OPTIMIZATION (ACO) ALGORITHM
// For Intelligent Task Allocation
// ========================================

class AntColonyOptimizer {
    constructor(complaints, technicians, config) {
        this.complaints = complaints;
        this.technicians = technicians;
        this.numAnts = config.numAnts || 20;
        this.alpha = config.alpha || 1.0;
        this.beta = config.beta || 2.0;
        this.rho = config.rho || 0.5;
        this.q = config.q || 100;
        this.iterations = config.iterations || 50;
        this.pheromones = new Map();
        this.bestSolution = null;
        this.bestFitness = Infinity;
    }
    
    calculateHeuristic(complaint, technician) {
        let score = 0;
        
        const skillMatch = this.getSkillMatchScore(complaint.category, technician.specialization);
        score += skillMatch * 0.4;
        
        const workloadScore = Math.max(0, 1 - (technician.currentWorkload / 10));
        score += workloadScore * 0.25;
        
        const priorityMultiplier = this.getPriorityMultiplier(complaint.priority);
        score += priorityMultiplier * 0.2;
        
        const zoneMatch = (complaint.zone === technician.zone) ? 1 : 0.3;
        score += zoneMatch * 0.15;
        
        return Math.max(0.01, Math.min(1, score));
    }
    
    getSkillMatchScore(category, specialization) {
        const skillMap = {
            'electricity': 'electrician',
            'plumbing': 'plumber',
            'furniture': 'carpenter',
            'security': 'security',
            'sanitation': 'general',
            'wifi': 'general',
            'noise': 'general',
            'other': 'general',
            'emergency': 'general'
        };
        const required = skillMap[category] || 'general';
        if (required === specialization) return 1.0;
        if (specialization === 'general') return 0.6;
        return 0.2;
    }
    
    getPriorityMultiplier(priority) {
        const multipliers = {
            'emergency': 2.0,
            'high': 1.5,
            'medium': 1.0,
            'low': 0.5
        };
        return multipliers[priority] || 1.0;
    }
    
    getPheromoneKey(complaintId, technicianId) {
        return `${complaintId}|${technicianId}`;
    }
    
    getPheromone(complaintId, technicianId) {
        const key = this.getPheromoneKey(complaintId, technicianId);
        return this.pheromones.get(key) || 0.1;
    }
    
    updatePheromone(complaintId, technicianId, delta) {
        const key = this.getPheromoneKey(complaintId, technicianId);
        const current = this.pheromones.get(key) || 0.1;
        this.pheromones.set(key, Math.max(0.01, Math.min(10, current + delta)));
    }
    
    evaporatePheromones() {
        for (let [key, value] of this.pheromones) {
            this.pheromones.set(key, value * (1 - this.rho));
        }
    }
    
    calculateAssignmentCost(assignment) {
        let totalCost = 0;
        let unassignedPenalty = 0;
        
        for (let [complaintId, technicianId] of Object.entries(assignment)) {
            const complaint = this.complaints.find(c => c.id === complaintId);
            const technician = this.technicians.find(t => t.id === technicianId);
            
            if (complaint && technician) {
                const heuristic = this.calculateHeuristic(complaint, technician);
                const pheromone = this.getPheromone(complaintId, technicianId);
                const cost = 1 / (Math.pow(pheromone, this.alpha) * Math.pow(heuristic, this.beta) + 0.01);
                totalCost += cost;
            } else {
                unassignedPenalty += 100;
            }
        }
        
        return totalCost + unassignedPenalty;
    }
    
    selectTechnicianForComplaint(complaint, availableTechnicians, workloads) {
        let totalProb = 0;
        const probabilities = [];
        
        for (const technician of availableTechnicians) {
            const currentWorkload = workloads.get(technician.id) || 0;
            const techWithWorkload = { ...technician, currentWorkload };
            
            const heuristic = this.calculateHeuristic(complaint, techWithWorkload);
            const pheromone = this.getPheromone(complaint.id, technician.id);
            const prob = Math.pow(pheromone, this.alpha) * Math.pow(heuristic, this.beta);
            
            probabilities.push({
                technician: technician,
                probability: prob
            });
            totalProb += prob;
        }
        
        if (totalProb === 0 || probabilities.length === 0) {
            return availableTechnicians[0] || null;
        }
        
        let random = Math.random() * totalProb;
        let cumulative = 0;
        
        for (const item of probabilities) {
            cumulative += item.probability;
            if (random <= cumulative) {
                return item.technician;
            }
        }
        
        return probabilities[0]?.technician || null;
    }
    
    constructSolution() {
        const assignment = {};
        const workloads = new Map();
        
        this.technicians.forEach(t => workloads.set(t.id, 0));
        
        const priorityOrder = { 'emergency': 4, 'high': 3, 'medium': 2, 'low': 1 };
        const sortedComplaints = [...this.complaints].sort((a, b) => {
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
        
        for (const complaint of sortedComplaints) {
            const availableTechs = this.technicians.filter(t => {
                const skillScore = this.getSkillMatchScore(complaint.category, t.specialization);
                return skillScore > 0.2;
            });
            
            if (availableTechs.length === 0) {
                assignment[complaint.id] = null;
                continue;
            }
            
            const selectedTech = this.selectTechnicianForComplaint(complaint, availableTechs, workloads);
            if (selectedTech) {
                assignment[complaint.id] = selectedTech.id;
                workloads.set(selectedTech.id, (workloads.get(selectedTech.id) || 0) + 1);
            }
        }
        
        return assignment;
    }
    
    async optimize() {
        console.log('🚀 Starting ACO optimization...');
        console.log(`📊 Config: Ants=${this.numAnts}, Iterations=${this.iterations}, Alpha=${this.alpha}, Beta=${this.beta}`);
        
        for (const complaint of this.complaints) {
            for (const technician of this.technicians) {
                const heuristic = this.calculateHeuristic(complaint, technician);
                this.updatePheromone(complaint.id, technician.id, heuristic * 0.1);
            }
        }
        
        const startTime = Date.now();
        
        for (let iter = 0; iter < this.iterations; iter++) {
            const solutions = [];
            const fitnesses = [];
            
            for (let ant = 0; ant < this.numAnts; ant++) {
                const solution = this.constructSolution();
                const cost = this.calculateAssignmentCost(solution);
                solutions.push(solution);
                fitnesses.push(cost);
            }
            
            let iterBestIdx = 0;
            let iterBestFitness = fitnesses[0];
            for (let i = 1; i < fitnesses.length; i++) {
                if (fitnesses[i] < iterBestFitness) {
                    iterBestFitness = fitnesses[i];
                    iterBestIdx = i;
                }
            }
            
            if (iterBestFitness < this.bestFitness) {
                this.bestFitness = iterBestFitness;
                this.bestSolution = solutions[iterBestIdx];
            }
            
            this.evaporatePheromones();
            
            if (this.bestSolution) {
                const depositAmount = this.q / (this.bestFitness + 0.01);
                for (const [complaintId, technicianId] of Object.entries(this.bestSolution)) {
                    if (technicianId) {
                        const complaint = this.complaints.find(c => c.id === complaintId);
                        const technician = this.technicians.find(t => t.id === technicianId);
                        if (complaint && technician) {
                            const heuristic = this.calculateHeuristic(complaint, technician);
                            this.updatePheromone(complaintId, technicianId, depositAmount * heuristic);
                        }
                    }
                }
            }
            
            if ((iter + 1) % 10 === 0) {
                console.log(`📈 Iteration ${iter + 1}/${this.iterations}: Best fitness = ${this.bestFitness.toFixed(4)}`);
            }
        }
        
        const endTime = Date.now();
        console.log(`✅ ACO completed in ${((endTime - startTime) / 1000).toFixed(2)}s`);
        console.log(`🏆 Final fitness: ${this.bestFitness.toFixed(4)}`);
        
        return {
            assignment: this.bestSolution,
            fitness: this.bestFitness,
            details: this.getAssignmentDetails()
        };
    }
    
    getAssignmentDetails() {
        const details = [];
        if (!this.bestSolution) return details;
        
        for (const [complaintId, technicianId] of Object.entries(this.bestSolution)) {
            const complaint = this.complaints.find(c => c.id === complaintId);
            const technician = this.technicians.find(t => t.id === technicianId);
            
            if (complaint && technician) {
                details.push({
                    complaintId: complaint.id,
                    complaintTitle: complaint.title,
                    complaintPriority: complaint.priority,
                    technicianId: technician.id,
                    technicianName: technician.name,
                    technicianSpecialization: technician.specialization,
                    heuristicScore: this.calculateHeuristic(complaint, technician)
                });
            }
        }
        
        return details;
    }
}

// ========================================
// AUTO-PRIORITY DETECTION FUNCTIONS
// ========================================

function detectAutoPriority(title, description, category) {
    let score = 0;
    const text = (title + ' ' + description).toLowerCase();
    
    const emergencyKeywords = [
        'fire', 'smoke', 'burning', 'emergency', 'urgent', 'immediate',
        'danger', 'hazard', 'broken pipe', 'flood', 'water leak',
        'electrical spark', 'short circuit', 'gas leak', 'medical',
        'injury', 'accident', 'collapsed', 'burst', 'severe'
    ];
    
    const highKeywords = [
        'no water', 'water outage', 'power outage', 'no electricity',
        'broken', 'not working', 'damage', 'leak', 'flooding',
        'security', 'threat', 'intruder', 'lock broken', 'door broken',
        'stuck', 'trapped', 'overflow', 'sewage', 'blocked'
    ];
    
    const mediumKeywords = [
        'slow', 'issue', 'problem', 'complaint', 'maintenance',
        'repair', 'fix', 'noisy', 'disturbance', 'clean',
        'dirty', 'clogged', 'flickering', 'intermittent'
    ];
    
    for (const keyword of emergencyKeywords) {
        if (text.includes(keyword)) {
            score += 4;
        }
    }
    
    for (const keyword of highKeywords) {
        if (text.includes(keyword)) {
            score += 2;
        }
    }
    
    for (const keyword of mediumKeywords) {
        if (text.includes(keyword)) {
            score += 1;
        }
    }
    
    const categoryWeights = {
        'electricity': 3,
        'plumbing': 3,
        'security': 4,
        'emergency': 4,
        'sanitation': 2,
        'furniture': 1,
        'wifi': 1,
        'noise': 1,
        'other': 1
    };
    
    score += categoryWeights[category] || 1;
    
    if (score >= 7) return 'emergency';
    if (score >= 5) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
}

function determineAutoRouting(priority, category, description) {
    const text = description.toLowerCase();
    
    if (priority === 'emergency') {
        return 'dsss_vc';
    }
    
    if (priority === 'high' && category === 'security') {
        return 'dsss';
    }
    
    if (priority === 'high' && (category === 'plumbing' || category === 'electricity')) {
        return 'maintenance';
    }
    
    if (text.includes('dsss') || text.includes('vc') || text.includes('vice chancellor') ||
        text.includes('complaint about staff') || text.includes('harassment') ||
        text.includes('corruption') || text.includes('misconduct')) {
        return 'dsss_vc';
    }
    
    if (priority === 'high') return 'dsss';
    return 'maintenance';
}

function getPriorityDisplay(priority) {
    const displays = {
        'low': 'Low (Minor Issue - Routine)',
        'medium': 'Medium (Normal Priority)',
        'high': 'High (Needs Immediate Attention)',
        'emergency': 'EMERGENCY (Critical - Immediate Action Required)'
    };
    return displays[priority] || priority;
}

function getRoutingDisplay(routing) {
    const displays = {
        'maintenance': 'Maintenance Team',
        'dsss': 'DSSS Office',
        'dsss_vc': 'DSSS & VC Office (Immediate Action)'
    };
    return displays[routing] || routing;
}

async function runACOAllocation(complaints, technicians) {
    if (!complaints || complaints.length === 0) {
        console.log('No complaints to allocate');
        return null;
    }
    
    if (!technicians || technicians.length === 0) {
        console.log('No technicians available');
        return null;
    }
    
    const pendingComplaints = complaints.filter(c => c.status === 'pending' || c.status === 'unassigned');
    
    if (pendingComplaints.length === 0) {
        console.log('No pending complaints');
        return null;
    }
    
    const aco = new AntColonyOptimizer(pendingComplaints, technicians, acoConfig);
    const result = await aco.optimize();
    
    return result;
}

async function allocateComplaint(complaint) {
    try {
        const techniciansSnapshot = await db.collection('technicians').get();
        const technicians = [];
        techniciansSnapshot.forEach(doc => {
            technicians.push({ id: doc.id, ...doc.data(), currentWorkload: 0 });
        });
        
        if (technicians.length === 0) {
            console.log('No technicians found');
            return null;
        }
        
        const tasksSnapshot = await db.collection('tasks')
            .where('status', 'in', ['assigned', 'in-progress'])
            .get();
        
        tasksSnapshot.forEach(doc => {
            const task = doc.data();
            const tech = technicians.find(t => t.id === task.technicianId);
            if (tech) {
                tech.currentWorkload = (tech.currentWorkload || 0) + 1;
            }
        });
        
        const aco = new AntColonyOptimizer([complaint], technicians, acoConfig);
        const result = await aco.optimize();
        
        if (result && result.assignment && result.assignment[complaint.id]) {
            const assignedTechId = result.assignment[complaint.id];
            const assignedTech = technicians.find(t => t.id === assignedTechId);
            
            await db.collection('tasks').add({
                complaintId: complaint.id,
                technicianId: assignedTechId,
                status: 'assigned',
                assignedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            await db.collection('complaints').doc(complaint.id).update({
                status: 'assigned',
                assignedTo: assignedTechId,
                assignedToName: assignedTech.name,
                assignedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            await db.collection('notifications').add({
                userId: complaint.studentId,
                title: 'Complaint Assigned',
                message: `Your complaint "${complaint.title}" has been assigned to ${assignedTech.name} (${assignedTech.specialization})`,
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            console.log(`✅ Complaint ${complaint.id} assigned to ${assignedTech.name}`);
            return assignedTech;
        }
        
        return null;
        
    } catch (error) {
        console.error('ACO allocation error:', error);
        return null;
    }
}

async function runBatchAllocation() {
    try {
        showToast('🔄 Running ACO optimization...', 'info');
        
        const complaintsSnapshot = await db.collection('complaints')
            .where('status', 'in', ['pending', 'unassigned'])
            .get();
        
        const complaints = [];
        complaintsSnapshot.forEach(doc => {
            const data = doc.data();
            complaints.push({
                id: doc.id,
                ...data,
                zone: data.hostelBlock ? data.hostelBlock.charAt(0) : 'A'
            });
        });
        
        const techniciansSnapshot = await db.collection('technicians')
            .where('isActive', '==', true)
            .get();
        
        const technicians = [];
        techniciansSnapshot.forEach(doc => {
            const data = doc.data();
            technicians.push({
                id: doc.id,
                ...data,
                currentWorkload: 0
            });
        });
        
        if (complaints.length === 0) {
            showToast('No pending complaints to allocate', 'info');
            return null;
        }
        
        if (technicians.length === 0) {
            showToast('No technicians available. Please add technicians first.', 'error');
            return null;
        }
        
        const tasksSnapshot = await db.collection('tasks')
            .where('status', 'in', ['assigned', 'in-progress'])
            .get();
        
        tasksSnapshot.forEach(doc => {
            const task = doc.data();
            const tech = technicians.find(t => t.id === task.technicianId);
            if (tech) {
                tech.currentWorkload++;
            }
        });
        
        const result = await runACOAllocation(complaints, technicians);
        
        if (result && result.assignment) {
            let assignedCount = 0;
            
            for (const [complaintId, technicianId] of Object.entries(result.assignment)) {
                if (technicianId) {
                    const complaint = complaints.find(c => c.id === complaintId);
                    const technician = technicians.find(t => t.id === technicianId);
                    
                    if (complaint && technician) {
                        await db.collection('tasks').add({
                            complaintId: complaintId,
                            technicianId: technicianId,
                            status: 'assigned',
                            assignedAt: firebase.firestore.FieldValue.serverTimestamp(),
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        
                        await db.collection('complaints').doc(complaintId).update({
                            status: 'assigned',
                            assignedTo: technicianId,
                            assignedToName: technician.name,
                            assignedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        
                        await db.collection('notifications').add({
                            userId: complaint.studentId,
                            title: 'Complaint Assigned',
                            message: `Your complaint "${complaint.title}" has been assigned to ${technician.name}`,
                            read: false,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        
                        assignedCount++;
                    }
                }
            }
            
            showToast(`✅ Successfully allocated ${assignedCount} complaints using ACO`, 'success');
            
            if (typeof loadAllComplaints === 'function') {
                loadAllComplaints();
            }
            
            return result;
        }
        
        showToast('No allocations were made', 'info');
        return null;
        
    } catch (error) {
        console.error('Batch allocation error:', error);
        showToast('Error running allocation: ' + error.message, 'error');
        return null;
    }
}

function saveAcoConfig() {
    const numAnts = parseInt(document.getElementById('acoAnts').value);
    const alpha = parseFloat(document.getElementById('acoAlpha').value);
    const beta = parseFloat(document.getElementById('acoBeta').value);
    const rho = parseFloat(document.getElementById('acoRho').value);
    const q = parseFloat(document.getElementById('acoQ').value);
    const iterations = parseInt(document.getElementById('acoIterations').value);
    
    acoConfig = { numAnts, alpha, beta, rho, q, iterations };
    saveAcoConfigToLocal();
    
    showToast('ACO Configuration saved successfully', 'success');
}

function loadAcoConfigToUI() {
    document.getElementById('acoAnts').value = acoConfig.numAnts;
    document.getElementById('acoAlpha').value = acoConfig.alpha;
    document.getElementById('acoBeta').value = acoConfig.beta;
    document.getElementById('acoRho').value = acoConfig.rho;
    document.getElementById('acoQ').value = acoConfig.q;
    document.getElementById('acoIterations').value = acoConfig.iterations;
}

async function runManualAllocation() {
    const resultDiv = document.getElementById('allocationResult');
    if (resultDiv) {
        resultDiv.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-pulse"></i> Running ACO optimization...</div>';
    }
    
    const result = await runBatchAllocation();
    
    if (result && result.details && resultDiv) {
        resultDiv.innerHTML = `
            <div class="allocation-summary">
                <div class="allocation-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                    <h3><i class="fas fa-chart-line"></i> ACO Allocation Results</h3>
                    <p><strong>Total Complaints Allocated:</strong> ${result.details.length}</p>
                    <p><strong>Optimization Fitness Score:</strong> ${result.fitness.toFixed(4)} (Lower is better)</p>
                    <p><strong>Algorithm Parameters:</strong> Ants=${acoConfig.numAnts}, Iterations=${acoConfig.iterations}, α=${acoConfig.alpha}, β=${acoConfig.beta}</p>
                </div>
                <div class="allocation-details">
                    <h4><i class="fas fa-list-check"></i> Assignment Details:</h4>
                    <div class="assignments-list">
                        ${result.details.map(d => `
                            <div class="assignment-item" style="background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid ${d.heuristicScore > 0.7 ? '#48bb78' : d.heuristicScore > 0.4 ? '#ed8936' : '#f56565'}">
                                <div style="display: flex; justify-content: space-between; flex-wrap: wrap;">
                                    <div>
                                        <strong>${escapeHtml(d.complaintTitle)}</strong>
                                        <span class="badge" style="background: ${d.complaintPriority === 'emergency' ? '#dc3545' : d.complaintPriority === 'high' ? '#ed8936' : d.complaintPriority === 'medium' ? '#4299e1' : '#48bb78'}">${d.complaintPriority.toUpperCase()}</span>
                                    </div>
                                    <div>
                                        <i class="fas fa-wrench"></i> ${d.technicianName} (${d.technicianSpecialization})
                                    </div>
                                </div>
                                <div style="margin-top: 8px; font-size: 0.9rem;">
                                    <span>Match Score: <strong>${(d.heuristicScore * 100).toFixed(1)}%</strong></span>
                                    <div style="width: 100%; background: #e2e8f0; border-radius: 10px; margin-top: 5px;">
                                        <div style="width: ${d.heuristicScore * 100}%; background: linear-gradient(90deg, #667eea, #764ba2); height: 6px; border-radius: 10px;"></div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    } else if (resultDiv && (!result || !result.details || result.details.length === 0)) {
        resultDiv.innerHTML = '<div class="alert alert-info">No pending complaints found or no technicians available for allocation.</div>';
    }
}

// Export functions
window.detectAutoPriority = detectAutoPriority;
window.determineAutoRouting = determineAutoRouting;
window.getPriorityDisplay = getPriorityDisplay;
window.getRoutingDisplay = getRoutingDisplay;