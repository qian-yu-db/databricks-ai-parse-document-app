"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from 'react';
import Link from "next/link";
import { ArrowLeft, Copy, CheckCircle, Database, Zap, Workflow, FileText, ExternalLink } from "lucide-react";

const sqlCode = `-- AI Functions Quick Start - SQL Queries with ai_query
-- Copy these into your Databricks SQL Editor

-- 1. Extract financial metrics using ai_query with dynamic JSON schema
SELECT ai_query(
  "databricks-meta-llama-3-3-70b-instruct",
  "You are an entity extraction expert. Your job is to identify and extract entities from the texts. Please identify all of these labels: revenue, net_income, eps, revenue_growth, outlook. " || 'Q4 2024 Earnings: Revenue $2.1B, 228% growth YoY. Net income $312M, EPS $2.85. Cloud division fastest growing.',
  responseFormat => '{
    "type": "json_schema",
    "json_schema": {
      "name": "document_extraction",
      "schema": {
        "type": "object",
        "properties": {
          "revenue": {"type": "string"},
          "net_income": {"type": "string"},
          "eps": {"type": "string"},
          "revenue_growth": {"type": "string"},
          "outlook": {"type": "string"}
        }
      },
      "strict": true
    }
  }'
) as extracted_financials;

-- 2. Analyze sentiment
SELECT 
  headline,
  ai_analyze_sentiment(headline) as sentiment
FROM (VALUES 
  ('Company announces breakthrough AI partnership'),
  ('Analysts concerned about rising operational costs'),
  ('CEO optimistic about Q1 2025 outlook')
) AS news(headline);

-- 3. Summarize reports
SELECT ai_summarize(
  'Company performance exceeded expectations with 30% international growth. New product line successful but margins tight due to supply costs. Management outlined cost mitigation strategy. Outlook positive but investors should watch macro environment.'
) as report_summary;

-- 4. Scale to production - Process entire portfolio with ai_query
/*
CREATE TABLE portfolio_analysis AS
SELECT 
  company_name,
  ai_query(
    "databricks-meta-llama-3-3-70b-instruct",
    "You are an entity extraction expert. Your job is to identify and extract entities from the texts. Please identify all of these labels: revenue, growth, outlook. " || earnings_text,
    responseFormat => '{
      "type": "json_schema",
      "json_schema": {
        "name": "document_extraction",
        "schema": {
          "type": "object",
          "properties": {
            "revenue": {"type": "string"},
            "growth": {"type": "string"},
            "outlook": {"type": "string"}
          }
        },
        "strict": true
      }
    }'
  ) as financials,
  ai_analyze_sentiment(news_text) as sentiment,
  ai_gen('Create investment memo: ' || earnings_text) as memo
FROM your_portfolio_table;
*/`;

export default function NextStepsPage() {
    const [copiedStates, setCopiedStates] = useState<{[key: string]: boolean}>({});

    const copyToClipboard = async (text: string, key: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedStates({...copiedStates, [key]: true});
            setTimeout(() => {
                setCopiedStates({...copiedStates, [key]: false});
            }, 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
            <header className="bg-white shadow-sm p-4 flex items-center justify-between">
                <Link href="/" className="text-blue-500 hover:underline flex items-center">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Home
                </Link>
                <h1 className="text-2xl font-semibold text-gray-800">Ready for Production Scale 🚀</h1>
            </header>

            <main className="max-w-6xl mx-auto p-8">
                {/* Hero Section */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Demo Complete!
                    </div>
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">
                        From 1 Company to 10,000+ Companies
                    </h1>
                    <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                        You've seen AI Functions work on one company. Now scale to your entire portfolio 
                        with <strong>Databricks Lakeflow</strong> - the unified data engineering solution.
                    </p>
                </div>

                {/* Lakeflow GA Announcement */}
                <Card className="mb-8 border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <CardHeader>
                        <CardTitle className="flex items-center text-blue-700">
                            <Zap className="mr-2 h-6 w-6" />
                            Now Generally Available: Databricks Lakeflow
                        </CardTitle>
                        <CardDescription>
                            The unified approach to data engineering - no more stitching together fragmented tools
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid md:grid-cols-3 gap-6 mb-6">
                            <div className="text-center p-4 bg-white rounded-lg border">
                                <Database className="h-8 w-8 mx-auto text-blue-600 mb-2" />
                                <h3 className="font-semibold text-blue-700">Lakeflow Connect</h3>
                                <p className="text-sm text-gray-600">Managed ingestion from enterprise apps, databases, and real-time streams</p>
                            </div>
                            <div className="text-center p-4 bg-white rounded-lg border">
                                <Database className="h-8 w-8 mx-auto text-blue-600 mb-2" />
                                <h3 className="font-semibold text-blue-700">Declarative Pipelines</h3>
                                <p className="text-sm text-gray-600">New "IDE for data engineering" with AI-assisted authoring</p>
                            </div>
                            <div className="text-center p-4 bg-white rounded-lg border">
                                <Workflow className="h-8 w-8 mx-auto text-blue-600 mb-2" />
                                <h3 className="font-semibold text-blue-700">Lakeflow Jobs</h3>
                                <p className="text-sm text-gray-600">Native orchestration with advanced control flow and monitoring</p>
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded border">
                            <p className="text-sm text-gray-700 italic mb-3">
                                "Half of data engineers say governance takes up more time than anything else. Lakeflow eliminates 
                                the complexity of stitched-together tools with unified governance through Unity Catalog." 
                                - <strong>The Economist Study</strong>
                            </p>
                            <Button variant="outline" className="text-blue-600 border-blue-600" asChild>
                                <Link href="https://www.databricks.com/blog/announcing-general-availability-databricks-lakeflow" target="_blank">
                                    Read Full GA Announcement <ExternalLink className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* SQL Code Section */}
                <div className="space-y-8">
                    <div className="text-center">
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">AI Functions SQL Queries 📋</h2>
                        <p className="text-lg text-gray-600">
                            Copy these SQL queries and run them directly in your Databricks SQL Editor
                        </p>
                    </div>

                    {/* SQL Example */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span className="flex items-center">
                                    <Database className="mr-2 h-5 w-5 text-blue-600" />
                                    AI Functions SQL Queries
                                </span>
                                <Button
                                    onClick={() => copyToClipboard(sqlCode, 'sql')}
                                    variant="outline"
                                    size="sm"
                                    className="flex items-center"
                                >
                                    {copiedStates.sql ? (
                                        <>
                                            <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                                            Copied!
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="mr-2 h-4 w-4" />
                                            Copy SQL
                                        </>
                                    )}
                                </Button>
                            </CardTitle>
                            <CardDescription>
                                Ready-to-run SQL queries using AI Functions - no setup required
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm max-h-80">
                                <code>{sqlCode}</code>
                            </pre>
                            <div className="mt-4 p-3 bg-blue-50 rounded border-l-4 border-blue-400">
                                <p className="text-sm text-blue-800">
                                    <strong>Usage:</strong> Copy each query into your Databricks SQL Editor and run individually
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* CTA */}
                <Card className="mt-12 bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                    <CardContent className="p-8 text-center">
                        <h2 className="text-2xl font-bold mb-4">Ready to Transform Your Investment Analysis?</h2>
                        <p className="text-lg mb-6 opacity-90">
                            From simple SQL functions to enterprise-scale portfolios - the power is in your hands
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                            <Button size="lg" variant="secondary" asChild>
                                <Link href="https://docs.databricks.com/aws/en/large-language-models/ai-functions" target="_blank">
                                    <FileText className="mr-2 h-5 w-5" />
                                    AI Functions Docs
                                </Link>
                            </Button>
                            <Button size="lg" variant="secondary" asChild>
                                <Link href="https://www.databricks.com/blog/announcing-general-availability-databricks-lakeflow" target="_blank">
                                    <Workflow className="mr-2 h-5 w-5" />
                                    Lakeflow GA Blog
                                </Link>
                            </Button>
                        </div>
                        <p className="text-sm mt-4 opacity-75">
                            Questions? Contact your Databricks team for personalized guidance on scaling to production
                        </p>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
} 