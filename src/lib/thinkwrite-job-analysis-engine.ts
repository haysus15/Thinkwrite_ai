// Intelligent Dual AI Job Analysis Engine
// Uses Claude for insights + OpenAI for structured data = Best of both worlds

import { chromium } from "playwright";
import axios from "axios";
import * as cheerio from "cheerio";

interface JobAnalysisInput {
  content: string;
  isUrl: boolean;
  userId: string;
}

type JobAnalysisResult = {
  success: boolean;

  // Core objects your API route expects
  jobDetails: any;
  hiddenInsights: any;
  industryIntelligence: any;
  companyIntelligence: any;
  atsKeywords: any;

  // Optional extras you already generate/return through formatForExistingUI
  strategicAdvice?: any;
  postingQuality?: any;
  analysisQuality?: any;

  error?: string;
};

export class DualAIJobAnalysisEngine {
  private openaiApiKey: string;
  private claudeApiKey: string;

  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY || "";
    this.claudeApiKey = process.env.CLAUDE_API_KEY || "";
  }

  async analyzeJob(input: JobAnalysisInput): Promise<JobAnalysisResult> {
    try {
      console.log(`🤖 Starting dual AI analysis for user: ${input.userId}`);

      // Step 1: Extract job content
      let jobContent: string;
      let applicationEmail: string | undefined;

      if (input.isUrl) {
        const scrapedData = await this.scrapeJobFromUrl(input.content);
        jobContent = scrapedData.description;
        applicationEmail = scrapedData.applicationEmail;
      } else {
        jobContent = input.content;
        applicationEmail = this.extractEmailFromText(input.content);
      }

      // Validate content
      if (!jobContent || jobContent.length < 50) {
        console.error("❌ Scraping failed - no job content extracted");
        throw new Error(
          "Could not extract job posting content from URL. Please try pasting the job description directly."
        );
      }

      console.log(`📄 Extracted job content: ${jobContent.length} characters`);

      // Step 2: Run parallel AI analysis
      const [openaiResults, claudeResults] = await Promise.allSettled([
        this.runOpenAIAnalysis(jobContent),
        this.runClaudeAnalysis(jobContent),
      ]);

      // Step 3: Merge results
      const mergedAnalysis = this.mergeAnalysisResults(openaiResults, claudeResults);

      // Step 4: Calculate DYNAMIC ATS score
      const dynamicATSScore = this.calculateDynamicATSScore(jobContent, mergedAnalysis);

      // Step 5: Format for UI with dynamic score
      const formattedResult = this.formatForExistingUI(
        mergedAnalysis,
        applicationEmail,
        dynamicATSScore
      );

      return {
        success: true,
        ...formattedResult,
      };
    } catch (error) {
      console.error("Dual AI analysis failed:", error);
      return {
        success: false,
        jobDetails: {} as any,
        hiddenInsights: {} as any,
        industryIntelligence: {} as any,
        companyIntelligence: {} as any,
        atsKeywords: {} as any,
        error: error instanceof Error ? error.message : "Analysis failed",
      };
    }
  }

  // Calculate dynamic ATS score based on actual job posting content
  // DETERMINISTIC - same input always produces same output
  private calculateDynamicATSScore(jobContent: string, analysisData: any): number {
    let score = 0;
    const contentLower = jobContent.toLowerCase();

    // Factor 1: Clarity & Structure (25 points max)
    const words = jobContent.split(/\s+/).length;
    const sentences = jobContent.split(/[.!?]+/).filter((s) => s.trim()).length;
    const avgSentenceLength = sentences > 0 ? words / sentences : 0;

    // Good sentence length (10-30 words avg) = 10 points
    if (avgSentenceLength >= 10 && avgSentenceLength <= 30) {
      score += 10;
    } else if (avgSentenceLength > 5 && avgSentenceLength < 40) {
      score += 5;
    }

    // Has clear sections = up to 10 points (2 per section found)
    const sectionKeywords = [
      "requirement",
      "qualification",
      "responsibilit",
      "skill",
      "experience",
      "education",
      "benefit",
      "about",
      "duties",
      "summary",
    ];
    const sectionsFound = sectionKeywords.filter((kw) => contentLower.includes(kw)).length;
    score += Math.min(sectionsFound * 2, 10);

    // Has bullet points or lists = 5 points
    const hasBullets = /[•\-\*]\s/.test(jobContent) || /^\s*\d+\./m.test(jobContent);
    if (hasBullets) score += 5;

    // Factor 2: Specificity (30 points max)
    // Has specific years of experience = 8 points
    const yearsMatch = jobContent.match(/(\d+)\+?\s*years?/gi);
    if (yearsMatch && yearsMatch.length > 0) {
      score += 8;
    }

    // Has education requirements = 5 points
    const degreeKeywords = [
      "bachelor",
      "master",
      "phd",
      "degree",
      "diploma",
      "certificate",
      "associate",
      "college",
    ];
    const hasEducation = degreeKeywords.some((kw) => contentLower.includes(kw));
    if (hasEducation) score += 5;

    // Has salary information = 7 points
    const hasSalary = /\$[\d,]+|\d+k\b|\d+K\b|salary|compensation|\d{2,3},\d{3}/i.test(
      jobContent
    );
    if (hasSalary) score += 7;

    // Has specific location = 5 points
    const hasLocation = /remote|hybrid|on-site|onsite|\b[A-Z]{2}\s+\d{5}\b|city|state/i.test(
      jobContent
    );
    if (hasLocation) score += 5;

    // Has job type specified = 5 points
    const hasJobType = /full-time|part-time|contract|temporary|permanent/i.test(jobContent);
    if (hasJobType) score += 5;

    // Factor 3: Keyword Richness (25 points max)
    const skillIndicators = [
      "experience",
      "knowledge",
      "proficient",
      "skilled",
      "ability",
      "capable",
      "familiar",
      "understanding",
      "expertise",
      "competent",
      "background",
    ];
    const skillMentions = skillIndicators.filter((kw) => contentLower.includes(kw)).length;
    score += Math.min(skillMentions * 2, 10);

    // Has specific tools/software mentioned = up to 10 points
    const toolPatterns =
      /\b(excel|word|outlook|salesforce|sap|oracle|jira|slack|zoom|teams|sharepoint|quickbooks|tableau|python|java|sql|aws|azure|google|microsoft|adobe|autocad|cargowise)\b/gi;
    const toolMatches = jobContent.match(toolPatterns) || [];
    const uniqueTools = [...new Set(toolMatches.map((t) => t.toLowerCase()))];
    score += Math.min(uniqueTools.length * 2, 10);

    // Has action verbs = up to 5 points
    const actionVerbs = [
      "manage",
      "lead",
      "develop",
      "create",
      "implement",
      "coordinate",
      "analyze",
      "design",
      "build",
      "maintain",
      "support",
      "ensure",
      "prepare",
      "review",
      "collaborate",
    ];
    const actionCount = actionVerbs.filter((v) => contentLower.includes(v)).length;
    score += Math.min(actionCount, 5);

    // Factor 4: Content Quality (20 points max)
    if (words >= 200 && words <= 2000) {
      score += 8;
    } else if (words >= 100 && words <= 3000) {
      score += 4;
    }

    const hasCompanyInfo =
      /about us|about the company|who we are|our company|our team|our mission|we are/i.test(
        jobContent
      );
    if (hasCompanyInfo) score += 4;

    const hasBenefits =
      /benefit|401k|insurance|pto|vacation|health|dental|vision|remote|flexible|bonus/i.test(
        jobContent
      );
    if (hasBenefits) score += 4;

    const hasApplicationInfo = /apply|submit|send|resume|cv|application|email|click|portal/i.test(
      jobContent
    );
    if (hasApplicationInfo) score += 4;

    const finalScore = Math.min(Math.max(Math.round(score), 25), 100);

    console.log(`📊 Dynamic ATS Score: ${finalScore}/100`);
    console.log(
      `   Breakdown: Words=${words}, Sections=${sectionsFound}, Tools=${uniqueTools.length}, Actions=${actionCount}`
    );

    return finalScore;
  }

  // OpenAI: Structured data extraction - comprehensive and detailed
  private async runOpenAIAnalysis(jobContent: string) {
    const prompt = `You are an expert job analysis system. Extract ALL relevant information from this job posting thoroughly.

JOB POSTING:
${jobContent}

CRITICAL INSTRUCTIONS:
1. Extract EVERY skill, requirement, and qualification mentioned
2. Be thorough - don't miss any technologies, tools, or certifications
3. Categorize skills accurately (technical vs soft skills)
4. Extract ALL action verbs used in responsibilities
5. Return ONLY valid JSON

{
  "jobDetails": {
    "title": "exact job title",
    "company": "company name", 
    "location": "location with remote/hybrid status if mentioned",
    "salary": "salary range if mentioned or null",
    "jobType": "full-time/part-time/contract if mentioned",
    "schedule": "work schedule if mentioned",
    "requirements": ["every requirement listed - be comprehensive"],
    "responsibilities": ["every responsibility listed - be comprehensive"],
    "benefits": ["any benefits mentioned"]
  },
  "atsKeywords": {
    "hardSkills": [
      {
        "skill": "technical skill name",
        "frequency": 1,
        "importance": "required|preferred|nice-to-have",
        "category": "technical|software|industry-specific|analytical",
        "context": "brief context of how it's mentioned"
      }
    ],
    "softSkills": [
      {
        "skill": "soft skill",
        "frequency": 1,
        "importance": "required|preferred",
        "context": "how it's mentioned"
      }
    ],
    "technologies": [
      {
        "technology": "software/tool/platform name",
        "frequency": 1,
        "category": "software|platform|tool|programming",
        "proficiencyLevel": "required|preferred|familiar"
      }
    ],
    "certifications": ["any certifications or licenses mentioned"],
    "experienceRequirements": {
      "yearsRequired": "X years",
      "yearsPreferred": "Y years if different",
      "level": "entry|mid|senior",
      "specificExperience": ["specific experience types required"]
    },
    "educationRequirements": [
      {
        "level": "degree level",
        "field": "field of study if specified",
        "requirement": "required|preferred"
      }
    ],
    "actionWords": ["every action verb from responsibilities section"],
    "industryTerms": ["industry-specific terminology used"],
    "keyPhrases": ["important phrases that should appear in a matching resume"]
  },
  "postingQuality": {
    "hasSalary": true/false,
    "hasRemoteInfo": true/false,
    "hasBenefits": true/false,
    "hasCompanyDescription": true/false,
    "hasClearRequirements": true/false,
    "totalRequirements": number,
    "totalResponsibilities": number
  }
}

Be THOROUGH - extract everything mentioned in the posting!`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are an expert at extracting comprehensive information from job postings. Extract every skill, requirement, technology, and qualification mentioned. Be thorough and detailed.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    try {
      let cleanedContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedContent = jsonMatch[0];
      }
      const parsed = JSON.parse(cleanedContent);
      console.log("✅ OpenAI Parsed Successfully:", parsed.jobDetails?.title);
      return parsed;
    } catch {
      console.error("❌ OpenAI JSON Parse Error");
      throw new Error("Failed to parse OpenAI JSON response");
    }
  }

  // Claude: Insights and strategic analysis
  private async runClaudeAnalysis(jobContent: string) {
    const prompt = `Analyze this job posting for hidden insights. Be CONCISE - short phrases only.

JOB POSTING:
${jobContent}

Return ONLY this JSON (keep all text values under 100 characters):
{
  "hiddenInsights": {
    "redFlags": [
      {"phrase": "exact phrase", "meaning": "brief interpretation", "severity": "high|medium|low", "advice": "short advice"}
    ],
    "positiveSignals": [
      {"signal": "positive indicator", "interpretation": "brief explanation"}
    ],
    "compensationClues": [
      {"clue": "compensation hint", "interpretation": "salary estimate", "confidence": "high|medium|low"}
    ],
    "cultureInsights": [
      {"indicator": "culture signal", "meaning": "brief meaning", "workLifeBalance": "good|concerning|unclear"}
    ]
  },
  "strategicAdvice": {
    "shouldApply": true,
    "reasoning": "one sentence recommendation",
    "riskAssessment": "low|medium|high",
    "negotiationLeverage": ["point 1", "point 2"],
    "interviewQuestions": ["question 1", "question 2"],
    "resumeStrategy": ["tip 1", "tip 2"]
  },
  "industryContext": {
    "sector": "industry name",
    "currentTrends": ["trend 1", "trend 2"],
    "salaryBenchmark": "$X - $Y",
    "competitionLevel": "high|medium|low",
    "hiringUrgency": "high|medium|low"
  },
  "companyIntelligence": {
    "companySignals": ["signal 1", "signal 2"],
    "likelyStack": ["tool 1", "tool 2"],
    "orgMaturity": "startup|growth|enterprise|unknown",
    "resumeAngle": ["angle 1", "angle 2"]
  }
}

CRITICAL: Keep responses SHORT. Max 3-5 items per array. No lengthy explanations.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": this.claudeApiKey,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content[0].text;

    try {
      let cleanedContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedContent = jsonMatch[0];
      }
      cleanedContent = cleanedContent.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
      const parsed = JSON.parse(cleanedContent);
      console.log("✅ Claude Parsed Successfully");
      return parsed;
    } catch (parseError) {
      console.error(
        "❌ Claude JSON Parse Error:",
        parseError instanceof Error ? parseError.message : "Unknown"
      );
      console.error("Raw content preview:", content.substring(0, 500));
      return null;
    }
  }

  private mergeAnalysisResults(openaiResults: any, claudeResults: any) {
    const openaiData = openaiResults.status === "fulfilled" ? openaiResults.value : null;
    const claudeData = claudeResults.status === "fulfilled" ? claudeResults.value : null;

    console.log(
      `🔄 Merging results - OpenAI: ${openaiData ? "✅" : "❌"}, Claude: ${claudeData ? "✅" : "❌"}`
    );

    return {
      jobDetails: openaiData?.jobDetails || this.getFallbackJobDetails(),
      atsKeywords: openaiData?.atsKeywords || this.getFallbackAtsKeywords(),
      hiddenInsights: claudeData?.hiddenInsights || this.getFallbackInsights(),
      strategicAdvice: claudeData?.strategicAdvice || this.getFallbackAdvice(),
      industryContext: claudeData?.industryContext || this.getFallbackIndustryContext(),

      // ✅ NEW: provide companyIntelligence (even if empty)
      companyIntelligence: claudeData?.companyIntelligence || {},

      analysisQuality: {
        dataExtraction: openaiData ? "high" : "fallback",
        insightAnalysis: claudeData ? "high" : "fallback",
        confidence: openaiData && claudeData ? "high" : "medium",
      },
    };
  }

  private formatForExistingUI(mergedAnalysis: any, applicationEmail?: string, dynamicATSScore?: number) {
    const jobDetails = mergedAnalysis.jobDetails || {};
    const atsKeywords = mergedAnalysis.atsKeywords || {};

    return {
      jobDetails: {
        title: jobDetails.title || "Position Title",
        company: jobDetails.company || "Company Name",
        location: jobDetails.location || "Location not specified",
        salary: jobDetails.salary || null,
        jobType: jobDetails.jobType || null,
        schedule: jobDetails.schedule || null,
        description: "",
        requirements: jobDetails.requirements || [],
        responsibilities: jobDetails.responsibilities || [],
        benefits: jobDetails.benefits || [],
        applicationEmail: applicationEmail,
      },

      atsKeywords: {
        hardSkills: (atsKeywords.hardSkills || []).map((skill: any) => ({
          skill: skill.skill,
          frequency: skill.frequency || 1,
          importance: this.normalizeImportance(skill.importance),
          category: skill.category || "general",
          context: skill.context || "",
        })),
        softSkills: (atsKeywords.softSkills || []).map((skill: any) => ({
          skill: skill.skill,
          frequency: skill.frequency || 1,
          importance: this.normalizeImportance(skill.importance),
          context: skill.context || "",
        })),
        technologies: (atsKeywords.technologies || []).map((tech: any) => ({
          technology: tech.technology,
          frequency: tech.frequency || 1,
          category: tech.category || "software",
          proficiencyLevel: tech.proficiencyLevel || "required",
        })),
        certifications: atsKeywords.certifications || [],
        educationRequirements: Array.isArray(atsKeywords.educationRequirements)
          ? atsKeywords.educationRequirements.map((edu: any) =>
              typeof edu === "string"
                ? edu
                : `${edu.level}${edu.field ? ` in ${edu.field}` : ""} (${edu.requirement || "preferred"})`
            )
          : [],
        experienceKeywords: [
          {
            keyword: atsKeywords.experienceRequirements?.yearsRequired || "Experience requirements unclear",
            level: atsKeywords.experienceRequirements?.level || "unclear",
            specificExperience: atsKeywords.experienceRequirements?.specificExperience || [],
            context: "Experience requirement",
            importance: "high" as const,
          },
        ],
        industryKeywords: atsKeywords.industryTerms || [],
        actionWords: atsKeywords.actionWords || [],
        keyPhrases: atsKeywords.keyPhrases || [],
        atsScore: dynamicATSScore || 50,
      },

      hiddenInsights: {
        phraseTranslations: (mergedAnalysis.hiddenInsights?.redFlags || []).map((flag: any) => ({
          original: flag.phrase,
          meaning: flag.meaning,
          severity: flag.severity || "medium",
          context: flag.advice || "",
        })),
        positiveSignals: (mergedAnalysis.hiddenInsights?.positiveSignals || []).map((signal: any) => ({
          signal: signal.signal,
          interpretation: signal.interpretation,
        })),
        urgencyIndicators: mergedAnalysis.industryContext?.hiringUrgency
          ? [`Hiring urgency: ${mergedAnalysis.industryContext.hiringUrgency}`]
          : [],
        cultureClues: (mergedAnalysis.hiddenInsights?.cultureInsights || []).map(
          (insight: any) =>
            `${insight.indicator}: ${insight.meaning}${
              insight.workLifeBalance ? ` (Work-life: ${insight.workLifeBalance})` : ""
            }`
        ),
        compensationSignals: (mergedAnalysis.hiddenInsights?.compensationClues || []).map((clue: any) =>
          typeof clue === "string"
            ? clue
            : `${clue.interpretation}${clue.confidence ? ` (${clue.confidence} confidence)` : ""}`
        ),
      },

      industryIntelligence: {
        sector: mergedAnalysis.industryContext?.sector || "General",
        hiringPatterns: mergedAnalysis.industryContext?.currentTrends || [],
        salaryBenchmark: mergedAnalysis.industryContext?.salaryBenchmark || null,
        competitionLevel: mergedAnalysis.industryContext?.competitionLevel || "medium",
        buzzwordMeanings: (mergedAnalysis.hiddenInsights?.redFlags || []).map(
          (flag: any) => `${flag.phrase}: ${flag.meaning}`
        ),
        applicationTips: mergedAnalysis.strategicAdvice?.resumeStrategy || [],
        interviewQuestions: mergedAnalysis.strategicAdvice?.interviewQuestions || [],
        negotiationLeverage: mergedAnalysis.strategicAdvice?.negotiationLeverage || [],
      },

      // ✅ NEW: returned in final result so API can persist it
      companyIntelligence: mergedAnalysis.companyIntelligence || {},

      strategicAdvice: {
        shouldApply: mergedAnalysis.strategicAdvice?.shouldApply ?? true,
        reasoning: mergedAnalysis.strategicAdvice?.reasoning || "",
        riskAssessment: mergedAnalysis.strategicAdvice?.riskAssessment || "medium",
      },

      postingQuality: mergedAnalysis.postingQuality || {
        hasSalary: false,
        hasRemoteInfo: false,
        hasBenefits: false,
        hasCompanyDescription: false,
        hasClearRequirements: false,
      },

      analysisQuality: mergedAnalysis.analysisQuality || {
        dataExtraction: "fallback",
        insightAnalysis: "fallback",
        confidence: "medium",
      },
    };
  }

  // Helper to normalize importance values
  private normalizeImportance(importance: string): "high" | "medium" | "low" {
    const imp = (importance || "").toLowerCase();
    if (
      imp.includes("required") ||
      imp.includes("high") ||
      imp.includes("must") ||
      imp.includes("critical")
    ) {
      return "high";
    }
    if (imp.includes("preferred") || imp.includes("medium") || imp.includes("should")) {
      return "medium";
    }
    return "low";
  }

  private getFallbackJobDetails() {
    return {
      title: "Job Position",
      company: "Company Name",
      location: "Location not specified",
      requirements: [],
      responsibilities: [],
    };
  }

  private getFallbackAtsKeywords() {
    return {
      hardSkills: [],
      softSkills: [],
      technologies: [],
      certifications: [],
      experienceRequirements: { yearsRequired: "Not specified", level: "unclear" },
      educationRequirements: [],
      actionWords: [],
    };
  }

  private getFallbackInsights() {
    return { redFlags: [], positiveSignals: [], compensationClues: [], cultureInsights: [] };
  }

  private getFallbackAdvice() {
    return {
      shouldApply: true,
      reasoning: "Analysis incomplete - manual review recommended",
      riskAssessment: "medium",
      negotiationLeverage: [],
      interviewQuestions: [],
      resumeStrategy: [],
    };
  }

  private getFallbackIndustryContext() {
    return {
      sector: "General",
      currentTrends: [],
      salaryBenchmark: "Research required",
      competitionLevel: "medium",
      hiringUrgency: "unclear",
    };
  }

  private async scrapeJobFromUrl(url: string): Promise<{ description: string; applicationEmail?: string }> {
    console.log("🔍 Scraping job URL:", url);

    try {
      const cheerioResult = await this.scrapeWithCheerio(url);
      if (cheerioResult.description && cheerioResult.description.length > 300) {
        return cheerioResult;
      }
    } catch (error) {
      console.log("⚠️ Cheerio failed:", error instanceof Error ? error.message : "Unknown error");
    }

    return await this.scrapeWithPlaywright(url);
  }

  private async scrapeWithCheerio(url: string): Promise<{ description: string; applicationEmail?: string }> {
    const { data: html } = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      timeout: 15000,
    });

    const $ = cheerio.load(html);
    $("script, style, nav, header, footer").remove();

    const selectors = [
      ".jv-job-detail-description",
      ".job-description",
      "#jobDescriptionText",
      ".description",
      "article",
      "main",
    ];
    let description = "";

    for (const selector of selectors) {
      const text = $(selector).text().trim();
      if (text && text.length > description.length && text.length > 100) {
        description = text;
      }
    }

    if (!description || description.length < 200) {
      description = $("body").text().replace(/\s+/g, " ").trim();
    }

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = html.match(emailRegex) || [];
    const applicationEmail = emails.find((e) => /career|job|talent|hr|recruit/i.test(e)) || emails[0];

    return { description, applicationEmail };
  }

  private async scrapeWithPlaywright(url: string): Promise<{ description: string; applicationEmail?: string }> {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(3000);

      const description = await page.evaluate(() => {
        document.querySelectorAll("script, style, nav, header, footer").forEach((el) => el.remove());
        return document.body.innerText;
      });

      const pageContent = await page.content();
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const emails: string[] = pageContent.match(emailRegex) || [];
      const applicationEmail = emails.find((e) => /career|job|talent|recruit/i.test(e)) || emails[0];

      return { description: description.trim(), applicationEmail };
    } finally {
      await browser.close();
    }
  }

  private extractEmailFromText(text: string): string | undefined {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails: string[] = text.match(emailRegex) || [];
    return emails.find((e) => /career|job|talent|hr/i.test(e)) || emails[0];
  }

  private async runSimpleOpenAIAnalysis(_input: JobAnalysisInput) {
    throw new Error("Fallback not implemented");
  }

  private async runSimpleClaudeAnalysis(_input: JobAnalysisInput) {
    throw new Error("Fallback not implemented");
  }
}

export default DualAIJobAnalysisEngine;
