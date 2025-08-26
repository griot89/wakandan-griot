/**
 * Research Agent - Specialized for information gathering, analysis, and research tasks
 * Handles web research, data analysis, report generation, and knowledge synthesis
 */

const BaseAgent = require('./BaseAgent');

class ResearchAgent extends BaseAgent {
    constructor(aiOrchestrator = null, webSearchTool = null) {
        super(
            'ResearchAgent',
            'A specialized agent for research, information gathering, data analysis, and knowledge synthesis',
            [
                'web_research',
                'data_analysis',
                'report_generation',
                'fact_checking',
                'trend_analysis',
                'competitive_analysis',
                'literature_review',
                'market_research'
            ],
            aiOrchestrator
        );
        
        this.webSearchTool = webSearchTool;
        
        // Research-specific configuration
        this.config = {
            ...this.config,
            maxSearchResults: 10,
            searchDepth: 'thorough', // quick, normal, thorough, deep
            factCheckingEnabled: true,
            citationStyle: 'academic',
            confidenceThreshold: 0.7,
            maxReportLength: 5000 // words
        };
        
        // Research cache to avoid duplicate searches
        this.searchCache = new Map();
        this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
    }

    async executeTask(task) {
        this.validateTaskParameters(task);
        
        const { type, parameters } = task;
        
        switch (type) {
            case 'web_research':
                return await this.performWebResearch(parameters);
                
            case 'data_analysis':
                return await this.analyzeData(parameters);
                
            case 'report_generation':
                return await this.generateReport(parameters);
                
            case 'fact_checking':
                return await this.factCheck(parameters);
                
            case 'trend_analysis':
                return await this.analyzeTrends(parameters);
                
            case 'competitive_analysis':
                return await this.analyzeCompetitors(parameters);
                
            case 'literature_review':
                return await this.reviewLiterature(parameters);
                
            case 'market_research':
                return await this.conductMarketResearch(parameters);
                
            default:
                throw new Error(`Research Agent does not support task type: ${type}`);
        }
    }

    async performWebResearch(params) {
        const { 
            query, 
            depth = this.config.searchDepth, 
            focus_areas = [], 
            sources = 'all',
            time_range = 'any'
        } = params;
        
        if (!query) {
            throw new Error('Web research requires a search query');
        }
        
        // Check cache first
        const cacheKey = this.getCacheKey('web_research', { query, depth, sources });
        const cachedResult = this.getFromCache(cacheKey);
        if (cachedResult) {
            return { ...cachedResult, from_cache: true };
        }
        
        console.log(`🔍 Performing ${depth} web research for: "${query}"`);
        
        const searchResults = await this.searchWeb(query, { 
            depth, 
            sources, 
            time_range,
            max_results: this.config.maxSearchResults 
        });
        
        // Analyze and synthesize findings
        const analysisPrompt = `Analyze the following web research results for the query: "${query}"

${focus_areas.length > 0 ? `Focus on these areas: ${focus_areas.join(', ')}` : ''}

Search Results:
${searchResults.map((result, i) => 
    `${i + 1}. ${result.title}\n   Source: ${result.url}\n   Content: ${result.snippet}\n`
).join('\n')}

Please provide:
1. Executive summary of key findings
2. Main themes and insights
3. Source reliability assessment
4. Gaps in available information
5. Recommendations for further research
6. Key statistics or data points
7. Citations and references`;

        const analysis = await this.queryAI(analysisPrompt, {
            system: 'You are a research analyst with expertise in information synthesis and source evaluation. Provide comprehensive, well-structured research analysis with proper citations.'
        });

        const result = {
            query: query,
            depth: depth,
            focus_areas: focus_areas,
            search_results: searchResults,
            analysis: analysis.content,
            sources_count: searchResults.length,
            confidence_score: this.assessResearchConfidence(searchResults, analysis.content),
            completed_at: new Date().toISOString(),
            cache_expires: new Date(Date.now() + this.cacheTimeout).toISOString()
        };
        
        // Cache the result
        this.saveToCache(cacheKey, result);
        
        return result;
    }

    async analyzeData(params) {
        const { data, analysis_type = 'descriptive', metrics = [], context = '' } = params;
        
        if (!data) {
            throw new Error('Data analysis requires data to analyze');
        }
        
        const dataString = typeof data === 'object' ? JSON.stringify(data, null, 2) : data.toString();
        
        const prompt = `Perform ${analysis_type} analysis on the following data:

Context: ${context}
Metrics of interest: ${metrics.join(', ')}

Data:
${dataString}

Please provide:
1. Data overview and structure
2. Key statistical measures (mean, median, mode, etc.)
3. Patterns and trends identified
4. Anomalies or outliers
5. Correlations and relationships
6. Insights and interpretations
7. Recommendations based on findings
8. Data quality assessment`;

        const analysis = await this.queryAI(prompt, {
            system: 'You are a data analyst with expertise in statistical analysis and data interpretation. Provide thorough, accurate analysis with actionable insights.'
        });

        return {
            data_summary: this.generateDataSummary(data),
            analysis_type: analysis_type,
            metrics: metrics,
            analysis: analysis.content,
            confidence_score: 0.8,
            data_points: this.countDataPoints(data),
            timestamp: new Date().toISOString()
        };
    }

    async generateReport(params) {
        const { 
            topic, 
            research_data, 
            report_type = 'comprehensive', 
            target_audience = 'general',
            length = 'medium' 
        } = params;
        
        if (!topic) {
            throw new Error('Report generation requires a topic');
        }
        
        // If research_data not provided, perform quick research
        let data = research_data;
        if (!data) {
            console.log('📋 No research data provided, performing quick research...');
            const quickResearch = await this.performWebResearch({
                query: topic,
                depth: 'normal'
            });
            data = quickResearch;
        }
        
        const lengthGuide = {
            'short': '500-1000 words',
            'medium': '1000-2500 words', 
            'long': '2500-5000 words',
            'comprehensive': '3000+ words'
        };
        
        const prompt = `Generate a ${report_type} report on "${topic}" for ${target_audience} audience.

Target length: ${lengthGuide[length]}

Research data available:
${typeof data === 'object' ? JSON.stringify(data, null, 2) : data}

Please structure the report with:
1. Executive Summary
2. Introduction and Background
3. Key Findings (with supporting data)
4. Analysis and Insights
5. Implications and Impact
6. Recommendations
7. Conclusion
8. References/Sources

Use clear, professional language appropriate for ${target_audience} audience.`;

        const report = await this.queryAI(prompt, {
            system: 'You are a professional report writer with expertise in research synthesis and technical communication. Create well-structured, informative reports with clear conclusions and actionable recommendations.'
        });

        return {
            topic: topic,
            report_type: report_type,
            target_audience: target_audience,
            estimated_length: lengthGuide[length],
            report_content: report.content,
            word_count: this.estimateWordCount(report.content),
            sections_included: this.extractSections(report.content),
            quality_score: 0.9,
            generated_at: new Date().toISOString()
        };
    }

    async factCheck(params) {
        const { claims, sources = [], context = '' } = params;
        
        if (!claims || claims.length === 0) {
            throw new Error('Fact checking requires claims to verify');
        }
        
        const claimsList = Array.isArray(claims) ? claims : [claims];
        const results = [];
        
        for (const claim of claimsList) {
            console.log(`🔍 Fact-checking: "${claim}"`);
            
            // Search for information about the claim
            const searchQuery = `fact check verify "${claim}"`;
            const searchResults = await this.searchWeb(searchQuery, { max_results: 5 });
            
            const verificationPrompt = `Fact-check the following claim:

Claim: "${claim}"
Context: ${context}

Available sources:
${searchResults.map(r => `- ${r.title}: ${r.snippet} (${r.url})`).join('\n')}

Additional sources provided:
${sources.join('\n')}

Please provide:
1. Verification status (True/False/Partially True/Unverifiable)
2. Supporting evidence
3. Contradicting evidence (if any)
4. Source reliability assessment
5. Confidence level (0-100%)
6. Additional context or nuances`;

            const verification = await this.queryAI(verificationPrompt, {
                system: 'You are a fact-checker with expertise in source evaluation and claim verification. Provide objective, evidence-based assessments.'
            });

            results.push({
                claim: claim,
                verification: verification.content,
                status: this.extractVerificationStatus(verification.content),
                confidence: this.extractConfidence(verification.content),
                sources_checked: searchResults.length + sources.length,
                checked_at: new Date().toISOString()
            });
        }

        return {
            claims_checked: results.length,
            results: results,
            overall_reliability: this.calculateOverallReliability(results),
            methodology: 'AI-assisted fact-checking with web source verification',
            timestamp: new Date().toISOString()
        };
    }

    async analyzeTrends(params) {
        const { topic, time_period = '1 year', data_sources = ['web'], metrics = [] } = params;
        
        if (!topic) {
            throw new Error('Trend analysis requires a topic');
        }
        
        console.log(`📈 Analyzing trends for: "${topic}" over ${time_period}`);
        
        // Search for trend-related information
        const trendQueries = [
            `${topic} trends ${time_period}`,
            `${topic} statistics ${time_period}`,
            `${topic} growth data ${time_period}`,
            `${topic} market analysis ${time_period}`
        ];
        
        const trendData = [];
        for (const query of trendQueries) {
            const results = await this.searchWeb(query, { max_results: 3 });
            trendData.push(...results);
        }
        
        const analysisPrompt = `Analyze trends for "${topic}" over the period: ${time_period}

Data sources:
${trendData.map(d => `- ${d.title}: ${d.snippet} (${d.url})`).join('\n')}

Metrics of interest: ${metrics.join(', ')}

Please provide:
1. Overall trend direction (growing, declining, stable, volatile)
2. Key growth metrics and statistics
3. Major inflection points or changes
4. Driving factors behind trends
5. Comparison with historical patterns
6. Future projections and outlook
7. Market implications
8. Confidence in trend assessment`;

        const analysis = await this.queryAI(analysisPrompt, {
            system: 'You are a trend analyst with expertise in market research and data interpretation. Provide insightful trend analysis with supporting evidence.'
        });

        return {
            topic: topic,
            time_period: time_period,
            trend_direction: this.extractTrendDirection(analysis.content),
            analysis: analysis.content,
            data_points: trendData.length,
            confidence_score: this.extractConfidence(analysis.content) / 100,
            metrics_analyzed: metrics,
            analyzed_at: new Date().toISOString()
        };
    }

    async analyzeCompetitors(params) {
        const { company, industry, competitors = [], focus_areas = ['products', 'pricing', 'strategy'] } = params;
        
        if (!company) {
            throw new Error('Competitive analysis requires a company name');
        }
        
        console.log(`🏢 Analyzing competitors for: ${company} in ${industry}`);
        
        // If no competitors provided, search for them
        let competitorList = competitors;
        if (competitorList.length === 0) {
            const competitorSearch = await this.searchWeb(`${company} competitors ${industry}`, { max_results: 5 });
            competitorList = this.extractCompetitorNames(competitorSearch);
        }
        
        const competitorData = [];
        for (const competitor of competitorList.slice(0, 5)) { // Limit to 5 competitors
            const compData = await this.searchWeb(`${competitor} ${focus_areas.join(' ')} analysis`, { max_results: 2 });
            competitorData.push({
                name: competitor,
                data: compData
            });
        }
        
        const analysisPrompt = `Perform competitive analysis for ${company} in the ${industry} industry:

Target company: ${company}
Competitors analyzed: ${competitorList.join(', ')}
Focus areas: ${focus_areas.join(', ')}

Competitive data:
${competitorData.map(c => 
    `${c.name}:\n${c.data.map(d => `  - ${d.title}: ${d.snippet}`).join('\n')}`
).join('\n\n')}

Please provide:
1. Competitive landscape overview
2. ${company}'s market position
3. Competitor strengths and weaknesses
4. Competitive advantages/disadvantages
5. Market gaps and opportunities
6. Threat assessment
7. Strategic recommendations
8. Market share insights (if available)`;

        const analysis = await this.queryAI(analysisPrompt, {
            system: 'You are a competitive intelligence analyst with expertise in market analysis and strategic assessment. Provide comprehensive competitive insights.'
        });

        return {
            company: company,
            industry: industry,
            competitors_analyzed: competitorList,
            focus_areas: focus_areas,
            analysis: analysis.content,
            market_position: this.extractMarketPosition(analysis.content),
            threat_level: this.assessThreatLevel(analysis.content),
            opportunities_identified: this.extractOpportunities(analysis.content),
            analyzed_at: new Date().toISOString()
        };
    }

    // Helper methods for web searching
    async searchWeb(query, options = {}) {
        const { depth = 'normal', max_results = 5, sources = 'all', time_range = 'any' } = options;
        
        // Mock web search implementation - in a real system, this would call actual search APIs
        console.log(`🌐 Searching web for: "${query}" (depth: ${depth})`);
        
        // If webSearchTool is available, use it
        if (this.webSearchTool) {
            try {
                const results = await this.webSearchTool.search(query, { limit: max_results });
                return results.map(r => ({
                    title: r.title,
                    url: r.url,
                    snippet: r.description || r.snippet,
                    relevance_score: 0.8
                }));
            } catch (error) {
                console.warn('Web search tool failed, using mock results:', error.message);
            }
        }
        
        // Mock results for demonstration
        return Array.from({ length: Math.min(max_results, 3) }, (_, i) => ({
            title: `Search Result ${i + 1} for "${query}"`,
            url: `https://example.com/result-${i + 1}`,
            snippet: `This is a mock search result snippet for the query about ${query}. It contains relevant information for research purposes.`,
            relevance_score: 0.9 - (i * 0.1)
        }));
    }

    // Cache management methods
    getCacheKey(operation, params) {
        return `${operation}_${JSON.stringify(params)}`;
    }

    getFromCache(key) {
        const cached = this.searchCache.get(key);
        if (cached && new Date(cached.expires) > new Date()) {
            return cached.data;
        }
        this.searchCache.delete(key);
        return null;
    }

    saveToCache(key, data) {
        this.searchCache.set(key, {
            data: data,
            expires: new Date(Date.now() + this.cacheTimeout)
        });
    }

    // Helper assessment methods
    assessResearchConfidence(results, analysis) {
        let confidence = 0.5; // Base confidence
        
        if (results.length >= 5) confidence += 0.2; // Multiple sources
        if (analysis.includes('reliable') || analysis.includes('credible')) confidence += 0.2;
        if (analysis.includes('consistent')) confidence += 0.1;
        
        return Math.min(confidence, 1.0);
    }

    generateDataSummary(data) {
        if (Array.isArray(data)) {
            return `Array with ${data.length} items`;
        } else if (typeof data === 'object') {
            return `Object with ${Object.keys(data).length} properties`;
        } else {
            return `${typeof data} data`;
        }
    }

    countDataPoints(data) {
        if (Array.isArray(data)) return data.length;
        if (typeof data === 'object') return Object.keys(data).length;
        return 1;
    }

    estimateWordCount(text) {
        return text.split(/\s+/).length;
    }

    extractSections(report) {
        const sections = [];
        const sectionMatches = report.match(/^\d+\.\s+([^:\n]+)/gm) || [];
        sections.push(...sectionMatches.map(match => match.replace(/^\d+\.\s+/, '')));
        return sections;
    }

    extractVerificationStatus(verification) {
        const status = verification.toLowerCase();
        if (status.includes('true') && !status.includes('false')) return 'True';
        if (status.includes('false') && !status.includes('true')) return 'False';
        if (status.includes('partially')) return 'Partially True';
        return 'Unverifiable';
    }

    extractConfidence(text) {
        const confidenceMatch = text.match(/confidence[:\s]+(\d+)%?/i);
        return confidenceMatch ? parseInt(confidenceMatch[1]) : 75;
    }

    calculateOverallReliability(results) {
        const trueCount = results.filter(r => r.status === 'True').length;
        return results.length > 0 ? (trueCount / results.length) * 100 : 0;
    }

    extractTrendDirection(analysis) {
        const text = analysis.toLowerCase();
        if (text.includes('growing') || text.includes('increasing')) return 'growing';
        if (text.includes('declining') || text.includes('decreasing')) return 'declining';
        if (text.includes('stable') || text.includes('steady')) return 'stable';
        if (text.includes('volatile') || text.includes('fluctuating')) return 'volatile';
        return 'unclear';
    }

    extractCompetitorNames(searchResults) {
        // Simple extraction - in real implementation, this would be more sophisticated
        const competitors = [];
        searchResults.forEach(result => {
            const matches = result.snippet.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
            competitors.push(...matches.slice(0, 2));
        });
        return [...new Set(competitors)].slice(0, 5); // Unique names, max 5
    }

    extractMarketPosition(analysis) {
        const text = analysis.toLowerCase();
        if (text.includes('leader') || text.includes('dominant')) return 'leader';
        if (text.includes('challenger') || text.includes('strong')) return 'challenger';
        if (text.includes('follower') || text.includes('behind')) return 'follower';
        if (text.includes('niche') || text.includes('specialized')) return 'niche';
        return 'unclear';
    }

    assessThreatLevel(analysis) {
        const text = analysis.toLowerCase();
        if (text.includes('high threat') || text.includes('serious competition')) return 'high';
        if (text.includes('moderate threat') || text.includes('competitive pressure')) return 'medium';
        if (text.includes('low threat') || text.includes('minimal competition')) return 'low';
        return 'medium';
    }

    extractOpportunities(analysis) {
        const opportunities = [];
        const opportunityMatches = analysis.match(/opportunity[:\s]+([^.!?]+)/gi) || [];
        opportunities.push(...opportunityMatches.map(match => 
            match.replace(/opportunity[:\s]+/i, '').trim()
        ));
        return opportunities.slice(0, 5);
    }

    validateTaskParameters(task) {
        super.validateTaskParameters(task);
        
        const { parameters } = task;
        
        // Task-specific validation
        switch (task.type) {
            case 'web_research':
                if (!parameters.query) {
                    throw new Error('Web research requires query parameter');
                }
                break;
                
            case 'data_analysis':
                if (!parameters.data) {
                    throw new Error('Data analysis requires data parameter');
                }
                break;
                
            case 'fact_checking':
                if (!parameters.claims || parameters.claims.length === 0) {
                    throw new Error('Fact checking requires claims parameter');
                }
                break;
                
            case 'competitive_analysis':
                if (!parameters.company) {
                    throw new Error('Competitive analysis requires company parameter');
                }
                break;
        }
        
        return true;
    }
}

module.exports = ResearchAgent;