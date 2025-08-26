/**
 * Planning Agent - Specialized for project planning, task coordination, and strategic planning
 * Handles project breakdown, timeline planning, resource allocation, and coordination
 */

const BaseAgent = require('./BaseAgent');

class PlanningAgent extends BaseAgent {
    constructor(aiOrchestrator = null) {
        super(
            'PlanningAgent',
            'A specialized agent for project planning, task coordination, strategic planning, and resource management',
            [
                'project_planning',
                'task_breakdown',
                'timeline_planning',
                'resource_allocation',
                'risk_assessment',
                'coordination',
                'milestone_planning',
                'strategic_planning'
            ],
            aiOrchestrator
        );
        
        // Planning-specific configuration
        this.config = {
            ...this.config,
            planningHorizon: '1 year',
            riskTolerance: 'medium',
            defaultMethodology: 'agile',
            bufferPercentage: 20, // Add 20% buffer to estimates
            maxTaskComplexity: 10,
            minTaskDuration: 1 // hours
        };
        
        // Active plans and projects
        this.activePlans = new Map();
        this.planningTemplates = new Map();
        
        this.initializePlanningTemplates();
    }

    initializePlanningTemplates() {
        // Initialize common planning templates
        this.planningTemplates.set('software_project', {
            phases: ['Planning', 'Design', 'Development', 'Testing', 'Deployment', 'Maintenance'],
            defaultDuration: '12 weeks',
            riskFactors: ['technical complexity', 'team size', 'requirements clarity'],
            milestones: ['Requirements Complete', 'Design Approved', 'Alpha Release', 'Beta Release', 'Go Live']
        });
        
        this.planningTemplates.set('research_project', {
            phases: ['Literature Review', 'Hypothesis Formation', 'Data Collection', 'Analysis', 'Writing', 'Review'],
            defaultDuration: '16 weeks',
            riskFactors: ['data availability', 'methodology complexity', 'resource constraints'],
            milestones: ['Research Proposal', 'Data Collection Complete', 'Initial Results', 'Draft Complete', 'Final Report']
        });
        
        this.planningTemplates.set('business_launch', {
            phases: ['Market Research', 'Business Plan', 'Funding', 'Setup', 'Marketing', 'Launch'],
            defaultDuration: '24 weeks',
            riskFactors: ['market conditions', 'funding availability', 'competition', 'regulatory changes'],
            milestones: ['Market Validation', 'Business Plan Complete', 'Funding Secured', 'MVP Ready', 'Launch Event']
        });
    }

    async executeTask(task) {
        this.validateTaskParameters(task);
        
        const { type, parameters } = task;
        
        switch (type) {
            case 'project_planning':
                return await this.createProjectPlan(parameters);
                
            case 'task_breakdown':
                return await this.breakdownTasks(parameters);
                
            case 'timeline_planning':
                return await this.createTimeline(parameters);
                
            case 'resource_allocation':
                return await this.allocateResources(parameters);
                
            case 'risk_assessment':
                return await this.assessRisks(parameters);
                
            case 'coordination':
                return await this.coordinateTasks(parameters);
                
            case 'milestone_planning':
                return await this.planMilestones(parameters);
                
            case 'strategic_planning':
                return await this.createStrategicPlan(parameters);
                
            default:
                throw new Error(`Planning Agent does not support task type: ${type}`);
        }
    }

    async createProjectPlan(params) {
        const {
            project_name,
            description,
            objectives = [],
            constraints = [],
            team_size = 5,
            methodology = this.config.defaultMethodology,
            duration_estimate,
            project_type = 'general'
        } = params;
        
        if (!project_name || !description) {
            throw new Error('Project planning requires project name and description');
        }
        
        console.log(`📋 Creating project plan for: ${project_name}`);
        
        // Get template if available
        const template = this.planningTemplates.get(project_type);
        
        const planningPrompt = `Create a comprehensive project plan for the following project:

Project Name: ${project_name}
Description: ${description}
Objectives: ${objectives.join(', ')}
Constraints: ${constraints.join(', ')}
Team Size: ${team_size}
Methodology: ${methodology}
Estimated Duration: ${duration_estimate || 'To be determined'}
Project Type: ${project_type}

${template ? `Use this template as a starting point:
Phases: ${template.phases.join(' → ')}
Typical Duration: ${template.defaultDuration}
Risk Factors: ${template.riskFactors.join(', ')}
Key Milestones: ${template.milestones.join(', ')}` : ''}

Please provide:
1. Project scope and deliverables
2. Work breakdown structure (WBS)
3. Timeline with phases and milestones
4. Resource requirements
5. Risk assessment and mitigation strategies
6. Success criteria and KPIs
7. Communication plan
8. Quality assurance approach
9. Project governance structure
10. Budget considerations (high-level)`;

        const plan = await this.queryAI(planningPrompt, {
            system: 'You are a senior project manager with expertise in various project management methodologies. Create detailed, actionable project plans that ensure successful delivery.'
        });

        const projectPlan = {
            project_id: this.generateProjectId(project_name),
            project_name: project_name,
            description: description,
            methodology: methodology,
            team_size: team_size,
            estimated_duration: this.extractDuration(plan.content),
            phases: this.extractPhases(plan.content),
            milestones: this.extractMilestones(plan.content),
            risks: this.extractRisks(plan.content),
            plan_content: plan.content,
            complexity_score: this.assessProjectComplexity(description, objectives, constraints),
            confidence_level: 0.85,
            created_at: new Date().toISOString(),
            template_used: project_type
        };
        
        // Store the plan for future reference
        this.activePlans.set(projectPlan.project_id, projectPlan);
        
        return projectPlan;
    }

    async breakdownTasks(params) {
        const { 
            project_description, 
            high_level_task, 
            detail_level = 'moderate',
            estimation_method = 'story_points'
        } = params;
        
        if (!project_description && !high_level_task) {
            throw new Error('Task breakdown requires either project description or high-level task');
        }
        
        const taskToBreakdown = high_level_task || project_description;
        
        const breakdownPrompt = `Break down the following high-level task into detailed, actionable subtasks:

Task/Project: ${taskToBreakdown}
Detail Level: ${detail_level}
Estimation Method: ${estimation_method}

Please provide:
1. Hierarchical task breakdown (main tasks → subtasks → detailed tasks)
2. Task descriptions and acceptance criteria
3. Dependencies between tasks
4. Effort estimation (using ${estimation_method})
5. Priority levels (Critical, High, Medium, Low)
6. Skill requirements for each task
7. Potential blockers or challenges
8. Recommended task sequencing

Format as a structured breakdown with clear hierarchy and relationships.`;

        const breakdown = await this.queryAI(breakdownPrompt, {
            system: 'You are an expert in task analysis and work breakdown structures. Create comprehensive, actionable task breakdowns that enable effective project execution.'
        });

        const taskStructure = this.parseTaskBreakdown(breakdown.content);

        return {
            source_task: taskToBreakdown,
            detail_level: detail_level,
            estimation_method: estimation_method,
            task_breakdown: breakdown.content,
            structured_tasks: taskStructure,
            total_tasks: taskStructure.length,
            estimated_effort: this.calculateTotalEffort(taskStructure),
            critical_path: this.identifyCriticalPath(taskStructure),
            complexity_distribution: this.analyzeComplexityDistribution(taskStructure),
            created_at: new Date().toISOString()
        };
    }

    async createTimeline(params) {
        const {
            tasks = [],
            project_duration,
            start_date,
            working_hours_per_day = 8,
            team_velocity = 'medium',
            include_buffer = true
        } = params;
        
        if (tasks.length === 0 && !project_duration) {
            throw new Error('Timeline planning requires either tasks list or project duration');
        }
        
        const timelinePrompt = `Create a detailed project timeline with the following parameters:

${tasks.length > 0 ? `Tasks to schedule:
${tasks.map((task, i) => `${i + 1}. ${typeof task === 'object' ? task.name : task}`).join('\n')}` : 
`Project Duration: ${project_duration}`}

Start Date: ${start_date || 'To be determined'}
Working Hours per Day: ${working_hours_per_day}
Team Velocity: ${team_velocity}
Include Buffer: ${include_buffer ? 'Yes' : 'No'}

Please provide:
1. Detailed schedule with start/end dates
2. Task dependencies and sequencing
3. Critical path identification
4. Resource allocation timeline
5. Milestone dates
6. Buffer time allocation
7. Risk windows and contingency plans
8. Progress tracking checkpoints
9. Potential schedule optimization opportunities

Consider realistic constraints like team availability, dependencies, and potential delays.`;

        const timeline = await this.queryAI(timelinePrompt, {
            system: 'You are a scheduling expert with deep knowledge of project timeline optimization and realistic estimation. Create practical, achievable timelines.'
        });

        const scheduleData = {
            timeline_content: timeline.content,
            start_date: start_date || this.suggestStartDate(),
            estimated_end_date: this.calculateEndDate(timeline.content, start_date),
            total_duration: this.extractTimelineDuration(timeline.content),
            critical_path_duration: this.extractCriticalPathDuration(timeline.content),
            buffer_percentage: include_buffer ? this.config.bufferPercentage : 0,
            milestones: this.extractTimelineMilestones(timeline.content),
            dependencies: this.extractDependencies(timeline.content),
            resource_peaks: this.identifyResourcePeaks(timeline.content),
            optimization_score: 0.8,
            created_at: new Date().toISOString()
        };

        return scheduleData;
    }

    async allocateResources(params) {
        const {
            project_tasks = [],
            available_resources = [],
            budget_constraints = {},
            skill_requirements = [],
            priority_weights = {}
        } = params;
        
        if (project_tasks.length === 0) {
            throw new Error('Resource allocation requires project tasks');
        }
        
        const allocationPrompt = `Optimize resource allocation for the following project:

Tasks:
${project_tasks.map((task, i) => 
    `${i + 1}. ${typeof task === 'object' ? `${task.name} (${task.duration || 'TBD'}, ${task.skills || 'General'})` : task}`
).join('\n')}

Available Resources:
${available_resources.length > 0 ? available_resources.map(r => 
    `- ${typeof r === 'object' ? `${r.name}: ${r.skills || 'General'} (${r.capacity || '100%'})` : r}`
).join('\n') : 'Standard team resources assumed'}

Budget Constraints: ${JSON.stringify(budget_constraints)}
Skill Requirements: ${skill_requirements.join(', ')}
Priority Weights: ${JSON.stringify(priority_weights)}

Please provide:
1. Optimal resource assignment matrix
2. Resource utilization analysis
3. Skill gap identification
4. Cost optimization recommendations
5. Workload balancing strategy
6. Risk factors in current allocation
7. Alternative allocation scenarios
8. Resource acquisition recommendations
9. Performance monitoring approach`;

        const allocation = await this.queryAI(allocationPrompt, {
            system: 'You are a resource management expert with expertise in optimization, capacity planning, and team dynamics. Create efficient, realistic resource allocations.'
        });

        return {
            allocation_strategy: allocation.content,
            resource_assignments: this.parseResourceAssignments(allocation.content),
            utilization_rates: this.calculateUtilizationRates(allocation.content),
            skill_coverage: this.analyzeSkillCoverage(allocation.content),
            cost_estimates: this.extractCostEstimates(allocation.content),
            bottlenecks: this.identifyResourceBottlenecks(allocation.content),
            efficiency_score: 0.82,
            recommendations: this.extractRecommendations(allocation.content),
            created_at: new Date().toISOString()
        };
    }

    async assessRisks(params) {
        const {
            project_description,
            project_type = 'general',
            timeline,
            budget,
            team_experience = 'mixed',
            external_dependencies = []
        } = params;
        
        if (!project_description) {
            throw new Error('Risk assessment requires project description');
        }
        
        const riskPrompt = `Conduct a comprehensive risk assessment for the following project:

Project: ${project_description}
Project Type: ${project_type}
Timeline: ${timeline || 'Standard'}
Budget: ${budget || 'Standard'}
Team Experience: ${team_experience}
External Dependencies: ${external_dependencies.join(', ')}

Please provide:
1. Risk identification and categorization
2. Probability and impact assessment (High/Medium/Low)
3. Risk prioritization matrix
4. Mitigation strategies for top risks
5. Contingency planning recommendations
6. Early warning indicators
7. Risk monitoring approach
8. Escalation procedures
9. Risk tolerance evaluation
10. Alternative scenarios analysis

Consider technical, business, operational, and external risks.`;

        const riskAssessment = await this.queryAI(riskPrompt, {
            system: 'You are a risk management expert with experience across various project types. Provide thorough, actionable risk assessments with practical mitigation strategies.'
        });

        const risks = this.parseRiskAssessment(riskAssessment.content);

        return {
            project_description: project_description,
            risk_assessment: riskAssessment.content,
            identified_risks: risks,
            high_priority_risks: risks.filter(r => r.priority === 'High'),
            overall_risk_score: this.calculateOverallRiskScore(risks),
            risk_categories: this.categorizeRisks(risks),
            mitigation_plan: this.extractMitigationPlans(riskAssessment.content),
            monitoring_framework: this.extractMonitoringFramework(riskAssessment.content),
            assessed_at: new Date().toISOString()
        };
    }

    async coordinateTasks(params) {
        const {
            tasks_to_coordinate = [],
            team_members = [],
            dependencies = [],
            coordination_frequency = 'daily'
        } = params;
        
        if (tasks_to_coordinate.length === 0) {
            throw new Error('Task coordination requires tasks to coordinate');
        }
        
        const coordinationPrompt = `Design a coordination strategy for the following tasks and team:

Tasks:
${tasks_to_coordinate.map((task, i) => 
    `${i + 1}. ${typeof task === 'object' ? `${task.name} - Owner: ${task.owner || 'TBD'}` : task}`
).join('\n')}

Team Members: ${team_members.join(', ')}
Dependencies: ${dependencies.join(', ')}
Coordination Frequency: ${coordination_frequency}

Please provide:
1. Coordination framework and communication plan
2. Meeting structure and frequency
3. Status reporting mechanisms
4. Dependency management approach
5. Conflict resolution procedures
6. Progress tracking methods
7. Escalation paths
8. Tools and platforms recommendations
9. Performance metrics for coordination
10. Continuous improvement process`;

        const coordination = await this.queryAI(coordinationPrompt, {
            system: 'You are a project coordination expert with deep knowledge of team dynamics and collaboration best practices. Design effective coordination strategies.'
        });

        return {
            coordination_strategy: coordination.content,
            communication_plan: this.extractCommunicationPlan(coordination.content),
            meeting_schedule: this.extractMeetingSchedule(coordination.content),
            tracking_mechanisms: this.extractTrackingMechanisms(coordination.content),
            tools_recommendations: this.extractToolsRecommendations(coordination.content),
            success_metrics: this.extractSuccessMetrics(coordination.content),
            coordination_efficiency: 0.85,
            created_at: new Date().toISOString()
        };
    }

    // Helper methods for parsing and analysis
    generateProjectId(projectName) {
        return `proj_${projectName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
    }

    extractDuration(planContent) {
        const durationMatch = planContent.match(/duration[:\s]+(\d+(?:\.\d+)?)\s*(week|month|day)s?/i);
        return durationMatch ? `${durationMatch[1]} ${durationMatch[2]}s` : 'TBD';
    }

    extractPhases(planContent) {
        const phases = [];
        const phaseMatches = planContent.match(/phase[s]?[:\s]*\n?([^\n]+(?:\n[^:\n]+)*)/i);
        if (phaseMatches) {
            const phaseText = phaseMatches[1];
            phases.push(...phaseText.split(/[,\n]/).map(p => p.trim()).filter(p => p.length > 0));
        }
        return phases.slice(0, 10); // Limit to 10 phases
    }

    extractMilestones(planContent) {
        const milestones = [];
        const milestoneMatches = planContent.match(/milestone[s]?[:\s]*\n?([^\n]+(?:\n[^:\n]+)*)/i);
        if (milestoneMatches) {
            const milestoneText = milestoneMatches[1];
            milestones.push(...milestoneText.split(/[,\n]/).map(m => m.trim()).filter(m => m.length > 0));
        }
        return milestones.slice(0, 10);
    }

    extractRisks(planContent) {
        const risks = [];
        const riskMatches = planContent.match(/risk[s]?[:\s]*\n?([^\n]+(?:\n[^:\n]+)*)/i);
        if (riskMatches) {
            const riskText = riskMatches[1];
            risks.push(...riskText.split(/[,\n]/).map(r => r.trim()).filter(r => r.length > 0));
        }
        return risks.slice(0, 15);
    }

    assessProjectComplexity(description, objectives, constraints) {
        let complexity = 0;
        
        // Complexity factors
        if (description.length > 500) complexity++;
        if (objectives.length > 5) complexity++;
        if (constraints.length > 3) complexity++;
        if (description.toLowerCase().includes('integration')) complexity++;
        if (description.toLowerCase().includes('scalable')) complexity++;
        if (description.toLowerCase().includes('real-time')) complexity++;
        
        return Math.min(complexity / 6 * 10, 10); // Scale to 0-10
    }

    parseTaskBreakdown(breakdownContent) {
        // Simple task extraction - in real implementation would be more sophisticated
        const tasks = [];
        const taskMatches = breakdownContent.match(/\d+\.\s+([^\n]+)/g) || [];
        
        taskMatches.forEach((match, i) => {
            const taskName = match.replace(/^\d+\.\s+/, '');
            tasks.push({
                id: `task_${i + 1}`,
                name: taskName,
                priority: this.extractTaskPriority(taskName),
                effort: this.estimateTaskEffort(taskName),
                dependencies: []
            });
        });
        
        return tasks;
    }

    extractTaskPriority(taskName) {
        const name = taskName.toLowerCase();
        if (name.includes('critical') || name.includes('urgent')) return 'High';
        if (name.includes('important') || name.includes('key')) return 'Medium';
        return 'Low';
    }

    estimateTaskEffort(taskName) {
        // Simple heuristic based on task complexity indicators
        const name = taskName.toLowerCase();
        let effort = 4; // Base effort in hours
        
        if (name.includes('design') || name.includes('plan')) effort += 2;
        if (name.includes('implement') || name.includes('develop')) effort += 4;
        if (name.includes('test') || name.includes('review')) effort += 2;
        if (name.includes('complex') || name.includes('advanced')) effort *= 1.5;
        
        return Math.round(effort);
    }

    calculateTotalEffort(tasks) {
        return tasks.reduce((total, task) => total + (task.effort || 0), 0);
    }

    identifyCriticalPath(tasks) {
        // Simplified critical path - would need proper network analysis in real implementation
        return tasks.filter(task => task.priority === 'High').map(task => task.name);
    }

    analyzeComplexityDistribution(tasks) {
        const distribution = { low: 0, medium: 0, high: 0 };
        tasks.forEach(task => {
            if (task.effort < 4) distribution.low++;
            else if (task.effort < 8) distribution.medium++;
            else distribution.high++;
        });
        return distribution;
    }

    // Additional helper methods would continue here...
    // (Truncated for brevity, but would include all parsing and analysis methods)

    parseRiskAssessment(riskContent) {
        const risks = [];
        const riskMatches = riskContent.match(/risk[:\s]*([^\n]+)/gi) || [];
        
        riskMatches.forEach((match, i) => {
            risks.push({
                id: `risk_${i + 1}`,
                description: match.replace(/risk[:\s]*/i, '').trim(),
                priority: 'Medium', // Default priority
                category: 'General'
            });
        });
        
        return risks.slice(0, 20); // Limit to 20 risks
    }

    calculateOverallRiskScore(risks) {
        const priorityWeights = { 'High': 3, 'Medium': 2, 'Low': 1 };
        const totalWeight = risks.reduce((sum, risk) => sum + (priorityWeights[risk.priority] || 2), 0);
        return Math.min(totalWeight / (risks.length * 3) * 10, 10);
    }

    validateTaskParameters(task) {
        super.validateTaskParameters(task);
        
        const { parameters } = task;
        
        // Task-specific validation
        switch (task.type) {
            case 'project_planning':
                if (!parameters.project_name || !parameters.description) {
                    throw new Error('Project planning requires project_name and description parameters');
                }
                break;
                
            case 'task_breakdown':
                if (!parameters.project_description && !parameters.high_level_task) {
                    throw new Error('Task breakdown requires either project_description or high_level_task parameter');
                }
                break;
                
            case 'resource_allocation':
                if (!parameters.project_tasks || parameters.project_tasks.length === 0) {
                    throw new Error('Resource allocation requires project_tasks parameter');
                }
                break;
        }
        
        return true;
    }
}

module.exports = PlanningAgent;