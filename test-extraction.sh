#!/bin/bash

curl -X POST http://localhost:3000/api/lex/extract-resume-suggestions \
  -H "Content-Type: application/json" \
  -d '{
    "conversationHistory": [
      {
        "role": "user",
        "content": "How can I reframe my existing experience to better match what they are looking for?"
      },
      {
        "role": "assistant",
        "content": "Alright, let me show you how to reframe what you already have. Lead with brokerage operations instead of advisory work. For example, instead of saying \"Provided expert guidance on 11 filing types\", reframe it to \"Process ISF, AMS, and entry documentation for ocean, air, and ground shipments across multiple product categories, maintaining compliance with CBP regulations\". This shows you can do the tactical work, not just advise on it."
      },
      {
        "role": "user",
        "content": "I want tactical brokerage experience as I am also going to start studying for my customs brokerage exam"
      },
      {
        "role": "assistant",
        "content": "NOW we are talking. That changes everything. Add a Professional Development section: \"Customs Broker License Preparation | In Progress, Exam Planned [Month/Year] - Pursuing U.S. Customs Broker License to complement compliance and systems expertise with operational brokerage credentials\". This shows this job fits into a bigger plan."
      }
    ],
    "resumeId": "test-resume-123",
    "jobId": "test-job-456"
  }'
