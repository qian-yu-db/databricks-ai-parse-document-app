import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-gray-50">
      {/* Header with logo */}
      <header className="w-full bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-8 py-4">
          <div className="flex items-center">
            <Image
              src="/Databricks_Logo.png"
              alt="Databricks Logo"
              width={240}
              height={80}
              className="h-16 w-auto"
              priority
            />
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-24 py-16">
        <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
          <h1 className="text-4xl font-bold text-center w-full">Intelligent Data Processing</h1>
        </div>
      <div className="text-center mt-4 mb-16">
        <p className="text-lg text-gray-600">Generative AI for Unstructured Data</p>
      </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 justify-center">
          <Link href="/document-intelligence/" className="w-full max-w-sm">
            <IndustryCard
              title="Document Intelligence"
              description="Upload documents so you can analyze and extract data using AI functions."
              active={true}
            />
          </Link>
          <div className="w-full max-w-sm">
            <IndustryCard
              title="Document Research Chatbot"
              description="Interactive question and answer bot for document"
              active={false}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

interface IndustryCardProps {
  title: string;
  description: string;
  active: boolean;
}

function IndustryCard({ title, description, active }: IndustryCardProps) {
  return (
    <Card className={`h-full transform transition-transform hover:scale-105 ${active ? 'cursor-pointer' : 'cursor-not-allowed bg-gray-100'}`}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {!active && <div className="text-xs font-semibold text-blue-500">(Coming Soon)</div>}
      </CardHeader>
      <CardContent>
        <CardDescription>
          {description}
        </CardDescription>
      </CardContent>
    </Card>
  );
}
