// Dashboard Guidance API - Lightweight Lex for Navigation
// src/app/api/lex/dashboard-guidance/route.ts

import { NextRequest, NextResponse } from 'next/server';

const DASHBOARD_LEX_PROMPT = `You are Lex, providing quick guidance on the Career Studio dashboard. Your role is to:

1. Give brief, actionable career advice (1-2 sentences max)
2. Guide users to the right Career Studio section
3. Be warm but concise - this is dashboard chat, not full conversation

**Career Studio Sections:**
- **Resume Manager**: Upload, analyze, manage resumes (mention for: resume, CV, upload, analyze resume)
- **Job Analysis**: Analyze job postings, research roles (mention for: job posting, job requirements, analyze job)
- **Tailoring**: Customize resumes for specific jobs (mention for: tailor, customize, ATS, optimize)
- **Cover Letter Generator**: Create cover letters (mention for: cover letter, application letter)
- **Applications Tracker**: Track job applications (mention for: track, applications, job search progress)
- **Full Chat**: Extended career discussions (mention for: detailed advice, strategy, career planning)

**Response Style:**
- Keep responses under 50 words
- Include section recommendation when relevant
- Use encouraging, professional tone
- Focus on immediate next steps

**Example Responses:**
"I'd love to help! Upload your resume to Resume Manager for detailed analysis and ATS scoring."
"Great question! Use Job Analysis to research that role and understand exactly what they're looking for."
"Let's optimize your applications! Try the Tailoring section to customize your resume for each job."

Always end with a clear action or suggestion that guides them to the right Career Studio section.`;

interface DashboardGuidanceRequest {
  message: string;
  userId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: DashboardGuidanceRequest = await request.json();
    const { message, userId } = body;

    if (!message?.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Check for Claude API key
    if (!process.env.CLAUDE_API_KEY) {
      return NextResponse.json({
        response: getDashboardFallbackResponse(message),
        navigationSuggestion: getNavigationSuggestion(message)
      });
    }

    try {
      // Call Claude API for dashboard guidance
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.CLAUDE_API_KEY!,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 150, // Keep responses short for dashboard
          system: DASHBOARD_LEX_PROMPT,
          messages: [
            {
              role: 'user',
              content: message
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.status}`);
      }

      const data = await response.json();
      const lexResponse = data.content[0].text;

      // Parse navigation suggestion from response
      const navigationSuggestion = parseNavigationFromResponse(lexResponse, message);

      return NextResponse.json({
        response: lexResponse,
        navigationSuggestion,
        timestamp: new Date().toISOString()
      });

    } catch (claudeError) {
      console.error('Claude API error in dashboard guidance:', claudeError);
      
      // Use intelligent fallback
      return NextResponse.json({
        response: getDashboardFallbackResponse(message),
        navigationSuggestion: getNavigationSuggestion(message)
      });
    }

  } catch (error) {
    console.error('Dashboard guidance error:', error);
    
    return NextResponse.json({
      response: "I'm here to help guide you through the Career Studio! What specific area would you like to explore?",
      navigationSuggestion: null
    });
  }
}

// Intelligent fallback responses for common dashboard questions
function getDashboardFallbackResponse(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('resume') && (lowerMessage.includes('upload') || lowerMessage.includes('analyze'))) {
    return "Perfect! Head to the Resume Manager to upload and get detailed analysis of your resume, including ATS scoring and optimization tips.";
  }
  
  if (lowerMessage.includes('job') && (lowerMessage.includes('posting') || lowerMessage.includes('analyze') || lowerMessage.includes('research'))) {
    return "Great idea! Use Job Analysis to break down job postings and understand exactly what employers are looking for.";
  }
  
  if (lowerMessage.includes('cover letter')) {
    return "Excellent! The Cover Letter Generator will help you create compelling, personalized cover letters that match your voice.";
  }
  
  if (lowerMessage.includes('tailor') || lowerMessage.includes('customize') || lowerMessage.includes('ats')) {
    return "Smart thinking! The Tailoring section will help you optimize your resume for specific roles and improve ATS compatibility.";
  }
  
  if (lowerMessage.includes('track') || lowerMessage.includes('application') || lowerMessage.includes('progress')) {
    return "Good organization! Check out Applications Tracker to monitor your job search progress and stay on top of deadlines.";
  }
  
  if (lowerMessage.includes('strategy') || lowerMessage.includes('plan') || lowerMessage.includes('advice')) {
    return "Let's dive deeper! Try the full Chat feature for comprehensive career strategy discussions and personalized guidance.";
  }
  
  // General encouraging response
  return "I'm here to help guide you through the Career Studio! Each section is designed to tackle different parts of your job search. What specific challenge are you facing?";
}

// Parse navigation suggestions from Claude's response
function parseNavigationFromResponse(response: string, originalMessage: string) {
  const lowerResponse = response.toLowerCase();
  
  if (lowerResponse.includes('resume manager')) {
    return {
      text: "Go to Resume Manager",
      href: "/career-studio/resume-manager"
    };
  }
  
  if (lowerResponse.includes('job analysis')) {
    return {
      text: "Analyze Job Posting",
      href: "/career-studio/job-analysis"
    };
  }
  
  if (lowerResponse.includes('tailoring')) {
    return {
      text: "Tailor Resume",
      href: "/career-studio/tailoring"
    };
  }
  
  if (lowerResponse.includes('cover letter')) {
    return {
      text: "Generate Cover Letter",
      href: "/career-studio/cover-letter"
    };
  }
  
  if (lowerResponse.includes('applications tracker') || lowerResponse.includes('track')) {
    return {
      text: "Track Applications",
      href: "/career-studio/applications"
    };
  }
  
  if (lowerResponse.includes('full chat') || lowerResponse.includes('chat feature')) {
    return {
      text: "Open Full Chat",
      href: "/career-studio/lex"
    };
  }
  
  // Fallback to message-based suggestion
  return getNavigationSuggestion(originalMessage);
}

// Get navigation suggestion based on user message keywords
function getNavigationSuggestion(message: string) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('resume')) {
    return {
      text: "Go to Resume Manager",
      href: "/career-studio/resume-manager"
    };
  }
  
  if (lowerMessage.includes('job') || lowerMessage.includes('posting')) {
    return {
      text: "Analyze Job Posting",
      href: "/career-studio/job-analysis"
    };
  }
  
  if (lowerMessage.includes('cover letter')) {
    return {
      text: "Generate Cover Letter",
      href: "/career-studio/cover-letter"
    };
  }
  
  if (lowerMessage.includes('tailor') || lowerMessage.includes('customize')) {
    return {
      text: "Tailor Resume",
      href: "/career-studio/tailoring"
    };
  }
  
  if (lowerMessage.includes('track') || lowerMessage.includes('application')) {
    return {
      text: "Track Applications",
      href: "/career-studio/applications"
    };
  }
  
  return null;
}

export async function GET() {
  return NextResponse.json({
    message: "Dashboard Guidance API - Lightweight Lex for Career Studio Navigation",
    features: [
      "Quick career guidance",
      "Section recommendations", 
      "Navigation suggestions",
      "Fallback responses"
    ],
    endpoints: {
      "POST": "Send message for guidance",
      "GET": "API status"
    }
  });
}