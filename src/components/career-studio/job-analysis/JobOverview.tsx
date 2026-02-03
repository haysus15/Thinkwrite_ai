"use client";

import React from 'react';
import type { JobDetails } from '../../../types/job-analysis';

interface JobOverviewProps {
  jobDetails: JobDetails;
  analysisId: string;
}

export default function JobOverview({ jobDetails, analysisId }: JobOverviewProps) {
  return (
    <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-6 shadow-2xl">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center space-x-3">
        <span className="text-3xl"></span>
        <span>Job Analysis Results</span>
      </h2>

      {/* Job Header */}
      <div className="bg-white/[0.02] rounded-xl p-6 border border-white/[0.05] mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-white mb-2">
              {jobDetails.title}
            </h3>
            <p className="text-white/80 text-lg font-medium mb-1">
              {jobDetails.company}
            </p>
            {jobDetails.location && (
              <p className="text-white/60 text-sm flex items-center space-x-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{jobDetails.location}</span>
              </p>
            )}
          </div>

          {/* Quick Indicators */}
          <div className="flex flex-col items-end space-y-2">
            {jobDetails.applicationEmail && (
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-emerald-500/20 rounded-full">
                <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
                <span className="text-emerald-400 text-sm font-medium">Direct Email</span>
              </div>
            )}
            
            {jobDetails.postedDate && (
              <span className="text-white/40 text-xs">
                Posted {jobDetails.postedDate}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Requirements & Responsibilities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Requirements */}
        {jobDetails.requirements && jobDetails.requirements.length > 0 && (
          <div className="bg-white/[0.02] rounded-xl p-5 border border-white/[0.05]">
            <h4 className="text-white font-semibold mb-4 flex items-center space-x-2">
              <span className="text-blue-400"></span>
              <span>Requirements</span>
            </h4>
            <ul className="space-y-2">
              {jobDetails.requirements.slice(0, 6).map((req, index) => (
                <li key={index} className="flex items-start space-x-2 text-sm text-white/80">
                  <span className="text-blue-400 mt-1 flex-shrink-0">•</span>
                  <span>{req}</span>
                </li>
              ))}
              {jobDetails.requirements.length > 6 && (
                <li className="text-white/60 text-xs italic">
                  +{jobDetails.requirements.length - 6} more requirements...
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Responsibilities */}
        {jobDetails.responsibilities && jobDetails.responsibilities.length > 0 && (
          <div className="bg-white/[0.02] rounded-xl p-5 border border-white/[0.05]">
            <h4 className="text-white font-semibold mb-4 flex items-center space-x-2">
              <span className="text-emerald-400"></span>
              <span>Responsibilities</span>
            </h4>
            <ul className="space-y-2">
              {jobDetails.responsibilities.slice(0, 6).map((resp, index) => (
                <li key={index} className="flex items-start space-x-2 text-sm text-white/80">
                  <span className="text-emerald-400 mt-1 flex-shrink-0">•</span>
                  <span>{resp}</span>
                </li>
              ))}
              {jobDetails.responsibilities.length > 6 && (
                <li className="text-white/60 text-xs italic">
                  +{jobDetails.responsibilities.length - 6} more responsibilities...
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Application Email Section */}
      {jobDetails.applicationEmail && (
        <div className="mt-6 bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 rounded-xl p-5 border border-emerald-500/20">
          <h4 className="text-emerald-400 font-semibold mb-2 flex items-center space-x-2">
            <span></span>
            <span>Direct Application Available</span>
          </h4>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-white/90 text-sm">
                Send resume to: 
              </span>
              <code className="bg-white/[0.05] px-3 py-1 rounded text-emerald-400 text-sm font-mono border border-white/[0.1]">
                {jobDetails.applicationEmail}
              </code>
            </div>
            <button className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-sm transition-colors border border-emerald-500/30">
              Copy Email
            </button>
          </div>
          <p className="text-white/60 text-xs mt-2">
            This email will be available when tailoring your resume for direct application.
          </p>
        </div>
      )}
    </div>
  );
}