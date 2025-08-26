/**
 * Code Agent - Specialized for software development tasks
 * Handles code generation, review, debugging, and technical planning
 */

const BaseAgent = require('./BaseAgent');

class CodeAgent extends BaseAgent {
    constructor(aiOrchestrator = null) {
        super(
            'CodeAgent',
            'A specialized agent for software development, code generation, debugging, and technical analysis',
            [
                'code_generation',
                'code_review', 
                'debugging',
                'technical_analysis',
                'architecture_planning',
                'documentation',
                'testing',
                'refactoring'
            ],
            aiOrchestrator
        );
        
        // Code-specific configuration
        this.config = {
            ...this.config,
            supportedLanguages: [
                'javascript', 'typescript', 'python', 'java', 'cpp', 'rust',
                'go', 'php', 'ruby', 'swift', 'kotlin', 'html', 'css', 'sql'
            ],
            codeQualityThreshold: 0.8,
            maxCodeLength: 10000, // lines
            defaultLanguage: 'javascript'
        };
    }

    async executeTask(task) {
        this.validateTaskParameters(task);
        
        const { type, parameters } = task;
        
        switch (type) {
            case 'code_generation':
                return await this.generateCode(parameters);
                
            case 'code_review':
                return await this.reviewCode(parameters);
                
            case 'debugging':
                return await this.debugCode(parameters);
                
            case 'technical_analysis':
                return await this.analyzeTechnology(parameters);
                
            case 'architecture_planning':
                return await this.planArchitecture(parameters);
                
            case 'documentation':
                return await this.generateDocumentation(parameters);
                
            case 'testing':
                return await this.generateTests(parameters);
                
            case 'refactoring':
                return await this.refactorCode(parameters);
                
            default:
                throw new Error(`Code Agent does not support task type: ${type}`);
        }
    }

    async generateCode(params) {
        const { description, language = this.config.defaultLanguage, style = 'clean', features = [] } = params;
        
        if (!description) {
            throw new Error('Code generation requires a description');
        }
        
        const prompt = `Generate ${language} code for the following requirement:

Description: ${description}
Language: ${language}
Style: ${style}
Required Features: ${features.join(', ')}

Please provide:
1. Clean, well-commented code
2. Error handling
3. Best practices
4. Brief explanation of the approach

Code:`;

        const response = await this.queryAI(prompt, {
            system: `You are an expert ${language} developer. Generate high-quality, production-ready code with proper error handling, comments, and following best practices.`
        });

        return {
            code: response.content,
            language: language,
            features: features,
            explanation: 'Code generated with best practices and error handling',
            quality_score: this.assessCodeQuality(response.content)
        };
    }

    async reviewCode(params) {
        const { code, language, focus_areas = ['quality', 'security', 'performance'] } = params;
        
        if (!code) {
            throw new Error('Code review requires code to review');
        }
        
        const prompt = `Review the following ${language} code:

\`\`\`${language}
${code}
\`\`\`

Focus areas: ${focus_areas.join(', ')}

Please provide:
1. Overall assessment
2. Issues found (critical, major, minor)
3. Specific suggestions for improvement
4. Security concerns if any
5. Performance optimization opportunities
6. Code quality rating (1-10)`;

        const response = await this.queryAI(prompt, {
            system: 'You are a senior code reviewer with expertise in software quality, security, and performance. Provide thorough, constructive feedback.'
        });

        return {
            review: response.content,
            language: language,
            focus_areas: focus_areas,
            quality_rating: this.extractQualityRating(response.content),
            timestamp: new Date().toISOString()
        };
    }

    async debugCode(params) {
        const { code, error, language, context = '' } = params;
        
        if (!code || !error) {
            throw new Error('Debugging requires both code and error information');
        }
        
        const prompt = `Debug the following ${language} code that is producing an error:

Code:
\`\`\`${language}
${code}
\`\`\`

Error: ${error}

Context: ${context}

Please provide:
1. Root cause analysis
2. Specific fix recommendations
3. Fixed code if applicable
4. Prevention strategies for similar issues`;

        const response = await this.queryAI(prompt, {
            system: 'You are an expert debugger with deep knowledge of common programming issues and their solutions. Provide clear, actionable debugging guidance.'
        });

        return {
            analysis: response.content,
            language: language,
            error_type: this.categorizeError(error),
            solution_confidence: 0.9, // High confidence for debugging
            timestamp: new Date().toISOString()
        };
    }

    async analyzeTechnology(params) {
        const { technology, use_case, requirements = [] } = params;
        
        if (!technology) {
            throw new Error('Technology analysis requires a technology to analyze');
        }
        
        const prompt = `Analyze the technology "${technology}" for the following use case:

Use Case: ${use_case}
Requirements: ${requirements.join(', ')}

Please provide:
1. Technology overview and key features
2. Pros and cons for this specific use case
3. Alternative technologies to consider
4. Implementation complexity assessment
5. Scalability and performance considerations
6. Community support and ecosystem
7. Recommendation (suitable/not suitable) with reasoning`;

        const response = await this.queryAI(prompt, {
            system: 'You are a technology consultant with deep knowledge of software architecture, frameworks, and development tools. Provide balanced, practical analysis.'
        });

        return {
            analysis: response.content,
            technology: technology,
            use_case: use_case,
            suitability_score: this.extractSuitabilityScore(response.content),
            alternatives: this.extractAlternatives(response.content),
            timestamp: new Date().toISOString()
        };
    }

    async planArchitecture(params) {
        const { project_description, requirements, scale, constraints = [] } = params;
        
        if (!project_description) {
            throw new Error('Architecture planning requires project description');
        }
        
        const prompt = `Plan a software architecture for the following project:

Project: ${project_description}
Requirements: ${requirements}
Scale: ${scale}
Constraints: ${constraints.join(', ')}

Please provide:
1. High-level architecture overview
2. Component breakdown and responsibilities
3. Technology stack recommendations
4. Data flow and storage strategy
5. Scalability considerations
6. Security architecture
7. Deployment strategy
8. Development phases/milestones`;

        const response = await this.queryAI(prompt, {
            system: 'You are a senior software architect with expertise in designing scalable, maintainable systems. Provide comprehensive architectural guidance.'
        });

        return {
            architecture: response.content,
            project: project_description,
            scale: scale,
            complexity_assessment: this.assessComplexity(requirements),
            recommended_timeline: this.estimateTimeline(scale, requirements),
            timestamp: new Date().toISOString()
        };
    }

    async generateDocumentation(params) {
        const { code, type = 'api', language, purpose } = params;
        
        if (!code) {
            throw new Error('Documentation generation requires code to document');
        }
        
        const prompt = `Generate ${type} documentation for the following ${language} code:

\`\`\`${language}
${code}
\`\`\`

Purpose: ${purpose}

Please provide:
1. Clear description of functionality
2. API endpoints/methods (if applicable)
3. Parameters and return values
4. Usage examples
5. Error scenarios
6. Dependencies and setup instructions`;

        const response = await this.queryAI(prompt, {
            system: 'You are a technical writer specializing in software documentation. Create clear, comprehensive documentation that helps developers understand and use the code effectively.'
        });

        return {
            documentation: response.content,
            type: type,
            language: language,
            completeness_score: 0.9,
            timestamp: new Date().toISOString()
        };
    }

    async generateTests(params) {
        const { code, language, test_framework = 'jest', coverage_target = 80 } = params;
        
        if (!code) {
            throw new Error('Test generation requires code to test');
        }
        
        const prompt = `Generate comprehensive unit tests for the following ${language} code using ${test_framework}:

\`\`\`${language}
${code}
\`\`\`

Target Coverage: ${coverage_target}%

Please provide:
1. Test cases covering main functionality
2. Edge cases and error scenarios
3. Mock setup if needed
4. Test data and fixtures
5. Performance tests if applicable`;

        const response = await this.queryAI(prompt, {
            system: `You are a test automation expert specializing in ${language} and ${test_framework}. Generate thorough, maintainable test suites.`
        });

        return {
            tests: response.content,
            language: language,
            framework: test_framework,
            estimated_coverage: coverage_target,
            test_count: this.countTests(response.content),
            timestamp: new Date().toISOString()
        };
    }

    async refactorCode(params) {
        const { code, language, goals = ['readability', 'performance', 'maintainability'] } = params;
        
        if (!code) {
            throw new Error('Code refactoring requires code to refactor');
        }
        
        const prompt = `Refactor the following ${language} code with focus on: ${goals.join(', ')}

Original Code:
\`\`\`${language}
${code}
\`\`\`

Please provide:
1. Refactored code with improvements
2. Explanation of changes made
3. Before/after comparison
4. Performance impact assessment
5. Potential breaking changes (if any)`;

        const response = await this.queryAI(prompt, {
            system: 'You are a code optimization expert. Refactor code to improve quality while maintaining functionality and minimizing breaking changes.'
        });

        return {
            refactored_code: response.content,
            language: language,
            goals: goals,
            improvement_areas: this.identifyImprovements(response.content),
            quality_improvement: 0.8,
            timestamp: new Date().toISOString()
        };
    }

    // Helper methods for code assessment
    assessCodeQuality(code) {
        // Basic code quality assessment
        let score = 0.5; // Base score
        
        if (code.includes('try')) score += 0.1; // Error handling
        if (code.includes('//') || code.includes('/*')) score += 0.1; // Comments
        if (code.includes('const') || code.includes('let')) score += 0.1; // Modern syntax
        if (code.length > 100) score += 0.1; // Substantial code
        if (!/console\.log/.test(code)) score += 0.1; // No debug statements
        
        return Math.min(score, 1.0);
    }

    extractQualityRating(review) {
        const ratingMatch = review.match(/rating[:\s]+(\d+(?:\.\d+)?)/i);
        return ratingMatch ? parseFloat(ratingMatch[1]) : 7.5;
    }

    categorizeError(error) {
        if (/syntax/i.test(error)) return 'syntax_error';
        if (/reference/i.test(error)) return 'reference_error';
        if (/type/i.test(error)) return 'type_error';
        if (/runtime/i.test(error)) return 'runtime_error';
        return 'unknown_error';
    }

    extractSuitabilityScore(analysis) {
        // Simple heuristic based on positive/negative sentiment
        const positive = (analysis.match(/suitable|good|excellent|recommended/gi) || []).length;
        const negative = (analysis.match(/not suitable|poor|avoid|problematic/gi) || []).length;
        return Math.max(0.1, Math.min(1.0, (positive - negative) / 10 + 0.5));
    }

    extractAlternatives(analysis) {
        // Extract technology alternatives mentioned in analysis
        const alternatives = [];
        const matches = analysis.match(/alternatives?[:\s]+([^.]+)/gi);
        if (matches) {
            matches.forEach(match => {
                const techs = match.split(/[,;]/).map(t => t.trim()).filter(t => t.length > 0);
                alternatives.push(...techs);
            });
        }
        return alternatives.slice(0, 5); // Limit to 5 alternatives
    }

    assessComplexity(requirements) {
        if (!requirements || typeof requirements !== 'string') return 'medium';
        
        const complexityIndicators = requirements.toLowerCase();
        let complexity = 0;
        
        if (complexityIndicators.includes('scale')) complexity++;
        if (complexityIndicators.includes('distributed')) complexity++;
        if (complexityIndicators.includes('real-time')) complexity++;
        if (complexityIndicators.includes('machine learning')) complexity++;
        if (complexityIndicators.includes('security')) complexity++;
        
        if (complexity >= 3) return 'high';
        if (complexity >= 1) return 'medium';
        return 'low';
    }

    estimateTimeline(scale, requirements) {
        const baseWeeks = {
            'small': 2,
            'medium': 8,
            'large': 20,
            'enterprise': 52
        };
        
        const multiplier = this.assessComplexity(requirements) === 'high' ? 1.5 : 1.0;
        return Math.ceil((baseWeeks[scale] || baseWeeks['medium']) * multiplier);
    }

    countTests(testCode) {
        const testMatches = testCode.match(/it\(|test\(|describe\(/g) || [];
        return testMatches.length;
    }

    identifyImprovements(refactoredContent) {
        const improvements = [];
        if (refactoredContent.includes('performance')) improvements.push('performance');
        if (refactoredContent.includes('readability')) improvements.push('readability');
        if (refactoredContent.includes('maintainability')) improvements.push('maintainability');
        if (refactoredContent.includes('security')) improvements.push('security');
        return improvements;
    }

    validateTaskParameters(task) {
        super.validateTaskParameters(task);
        
        const { parameters } = task;
        
        // Task-specific validation
        switch (task.type) {
            case 'code_generation':
                if (!parameters.description) {
                    throw new Error('Code generation requires description parameter');
                }
                break;
                
            case 'code_review':
            case 'debugging':
            case 'refactoring':
                if (!parameters.code) {
                    throw new Error(`${task.type} requires code parameter`);
                }
                break;
                
            case 'technical_analysis':
                if (!parameters.technology) {
                    throw new Error('Technology analysis requires technology parameter');
                }
                break;
                
            case 'architecture_planning':
                if (!parameters.project_description) {
                    throw new Error('Architecture planning requires project_description parameter');
                }
                break;
        }
        
        return true;
    }
}

module.exports = CodeAgent;