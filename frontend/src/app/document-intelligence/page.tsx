"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useRef, useEffect } from 'react';
import Link from "next/link";
import { ArrowLeft, Upload, FileText, Database, Settings, AlertCircle, File, Eye, Play, Loader2, Lightbulb, Save, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { apiCall } from "@/lib/api-config";
import { FloatingTooltip } from "@/components/ui/floating-tooltip";

// Helper function to format state names for better UX
const formatStateName = (state: string): string => {
    const stateMap: Record<string, string> = {
        'BLOCKED': 'PENDING',
        'TERMINATED': 'COMPLETED',
        'SUCCESS': 'SUCCESS',
        'FAILED': 'FAILED',
        'RUNNING': 'RUNNING',
        'PENDING': 'PENDING',
        'TERMINATING': 'FINISHING',
        'CANCELED': 'CANCELED'
    };
    return stateMap[state] || state;
};

// Helper function to calculate duration in seconds
const calculateDuration = (startTime: number | null, endTime: number | null): string => {
    if (!startTime) return '';
    if (!endTime) return '...';
    const durationMs = endTime - startTime;
    const durationSec = Math.round(durationMs / 1000);
    return `${durationSec}s`;
};

interface SelectedFile {
    file: File;
    name: string;
    size: number;
    type: string;
    preview?: string;
    previewUrl?: string;
    isUploaded: boolean;
    ucPath?: string;
    isProcessing: boolean;
    processError?: string;
}

interface WarehouseConfig {
    warehouse_id: string;
    default_warehouse_id: string;
}

interface VolumePathConfig {
    volume_path: string;
    default_volume_path: string;
}

interface DeltaTablePathConfig {
    delta_table_path: string;
    default_delta_table_path: string;
}

export default function DocumentIntelligencePage() {
    // Mode selection: 'interactive' or 'batch'
    const [processingMode, setProcessingMode] = useState<'interactive' | 'batch' | null>(null);

    // Batch mode state
    const [batchJobConfig, setBatchJobConfig] = useState<any>(null);
    const [batchJobConfigLoading, setBatchJobConfigLoading] = useState(false);
    const [batchFiles, setBatchFiles] = useState<File[]>([]);
    const [batchUploadProgress, setBatchUploadProgress] = useState<{uploading: boolean, total: number, uploaded: number}>({uploading: false, total: 0, uploaded: 0});
    const [batchJobRunId, setBatchJobRunId] = useState<number | null>(null);
    const [batchJobStatus, setBatchJobStatus] = useState<any>(null);
    const [batchJobPolling, setBatchJobPolling] = useState(false);
    const batchFileInputRef = useRef<HTMLInputElement>(null);

    // Batch job configuration state
    const [showBatchJobConfig, setShowBatchJobConfig] = useState(false);
    const [newBatchJobId, setNewBatchJobId] = useState('');
    const [batchJobUpdateLoading, setBatchJobUpdateLoading] = useState(false);
    const [batchJobUpdateSuccess, setBatchJobUpdateSuccess] = useState(false);

    const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
    const [activeFileIndex, setActiveFileIndex] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Demo Value and Settings state
    const [showValueModal, setShowValueModal] = useState(false);
    const [showWarehouseConfig, setShowWarehouseConfig] = useState(false);
    const [warehouseConfig, setWarehouseConfig] = useState<WarehouseConfig>({ warehouse_id: '', default_warehouse_id: '' });
    const [newWarehouseId, setNewWarehouseId] = useState('');
    const [warehouseLoading, setWarehouseLoading] = useState(false);
    const [warehouseSuccess, setWarehouseSuccess] = useState(false);

    // Volume path configuration state
    const [volumePathConfig, setVolumePathConfig] = useState<VolumePathConfig>({ volume_path: '', default_volume_path: '' });
    const [newVolumePath, setNewVolumePath] = useState('');
    const [volumePathLoading, setVolumePathLoading] = useState(false);
    const [volumePathSuccess, setVolumePathSuccess] = useState(false);

    // Delta table path configuration state
    const [deltaTablePathConfig, setDeltaTablePathConfig] = useState<DeltaTablePathConfig>({ delta_table_path: '', default_delta_table_path: '' });
    const [newDeltaTablePath, setNewDeltaTablePath] = useState('');
    const [deltaTablePathLoading, setDeltaTablePathLoading] = useState(false);
    const [deltaTablePathSuccess, setDeltaTablePathSuccess] = useState(false);

    // Collapse state for panels
    const [isDocumentPreviewCollapsed, setIsDocumentPreviewCollapsed] = useState(false);
    const [isFileUploadCollapsed, setIsFileUploadCollapsed] = useState(false);
    const [isSelectedFilesCollapsed, setIsSelectedFilesCollapsed] = useState(false);
    const [isDeltaTableResultsCollapsed, setIsDeltaTableResultsCollapsed] = useState(false);
    const [isVisualizationCollapsed, setIsVisualizationCollapsed] = useState(false);

    // Delta table state
    const [deltaTableResults, setDeltaTableResults] = useState<any[]>([]);
    const [deltaTableLoading, setDeltaTableLoading] = useState(false);
    const [deltaTableError, setDeltaTableError] = useState<string | null>(null);
    const [processedSessionFiles, setProcessedSessionFiles] = useState<string[]>([]);
    const [showDeltaTableResults, setShowDeltaTableResults] = useState(false);

    // Page pagination state
    const [pageMetadata, setPageMetadata] = useState<{total_pages: number, total_elements: number, pages: any[]} | null>(null);
    const [selectedPageNumber, setSelectedPageNumber] = useState<number | null>(null);
    const [pageMetadataLoading, setPageMetadataLoading] = useState(false);

    // AI Functions test state
    const [aiTestLoading, setAiTestLoading] = useState(false);
    const [aiTestResult, setAiTestResult] = useState<{success: boolean, message: string} | null>(null);
    
    // Image visualization state
    const [imageVisualization, setImageVisualization] = useState<{[pageId: string]: {image_base64: string, elements: any[]}} | null>(null);
    const [imageVisualizationLoading, setImageVisualizationLoading] = useState<string | null>(null);
    const [imageVisualizationError, setImageVisualizationError] = useState<string | null>(null);
    
    // Zoom state for page visualizations
    const [pageZoomLevels, setPageZoomLevels] = useState<{[pageId: string]: number | 'fit'}>({});
    
    // Hovering state for element highlighting
    const [hoveredElement, setHoveredElement] = useState<any | null>(null);

    // Utility function to extract error message from various error types
    const getErrorMessage = (err: unknown): string => {
        // Debug logging to understand what we're receiving
        console.log('getErrorMessage received:', err, 'type:', typeof err);
        
        if (err instanceof Error) {
            return err.message;
        } else if (typeof err === 'string') {
            return err;
        } else if (err && typeof err === 'object') {
            const errObj = err as any;
            // Try multiple properties that might contain the error message
            const message = errObj.detail || errObj.message || errObj.error || errObj.statusText;
            if (message && typeof message === 'string') {
                return message;
            }
            // If no string message found, stringify the object but make it readable
            try {
                return JSON.stringify(err, null, 2);
            } catch {
                return 'Error object could not be serialized';
            }
        }
        return 'An unknown error occurred';
    };

    // Test AI Functions availability
    const testAiFunctions = async () => {
        setAiTestLoading(true);
        setAiTestResult(null);
        
        try {
            const response = await apiCall("/api/test-ai-functions", {
                method: "POST"
            });
            
            setAiTestResult({
                success: response.success,
                message: response.message
            });
        } catch (err) {
            setAiTestResult({
                success: false,
                message: getErrorMessage(err)
            });
        } finally {
            setAiTestLoading(false);
        }
    };

    // Load configuration on component mount
    useEffect(() => {
        const loadConfigurations = async () => {
            try {
                // Load warehouse config
                const warehouseConfig = await apiCall("/api/warehouse-config");
                setWarehouseConfig(warehouseConfig);
                setNewWarehouseId(warehouseConfig.warehouse_id || '');

                // Load volume path config
                const volumePathConfig = await apiCall("/api/volume-path-config");
                setVolumePathConfig(volumePathConfig);
                setNewVolumePath(volumePathConfig.volume_path || '');

                // Load delta table path config
                const deltaTablePathConfig = await apiCall("/api/delta-table-path-config");
                setDeltaTablePathConfig(deltaTablePathConfig);
                setNewDeltaTablePath(deltaTablePathConfig.delta_table_path || '');
            } catch (err) {
                console.warn('Failed to load configurations:', err);
            }
        };

        loadConfigurations();
    }, []);

    // Update warehouse configuration
    const updateWarehouseConfig = async () => {
        if (!newWarehouseId.trim()) return;
        
        setWarehouseLoading(true);
        setWarehouseSuccess(false);
        
        try {
            const result = await apiCall("/api/warehouse-config", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ warehouse_id: newWarehouseId.trim() }),
            });
            
            if (result.success) {
                setWarehouseConfig(prev => ({ ...prev, warehouse_id: result.warehouse_id }));
                setWarehouseSuccess(true);
                setTimeout(() => setWarehouseSuccess(false), 3000);
            } else {
                throw new Error(result.message || 'Failed to update warehouse ID');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update warehouse configuration');
        } finally {
            setWarehouseLoading(false);
        }
    };

    // Update volume path configuration
    const updateVolumePathConfig = async () => {
        if (!newVolumePath.trim()) return;
        
        setVolumePathLoading(true);
        setVolumePathSuccess(false);
        
        try {
            const result = await apiCall("/api/volume-path-config", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ volume_path: newVolumePath.trim() }),
            });
            
            if (result.success) {
                setVolumePathConfig(prev => ({ ...prev, volume_path: result.volume_path }));
                setVolumePathSuccess(true);
                setTimeout(() => setVolumePathSuccess(false), 3000);
            } else {
                throw new Error(result.message || 'Failed to update volume path');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update volume path configuration');
        } finally {
            setVolumePathLoading(false);
        }
    };

    // Update delta table path configuration
    const updateDeltaTablePathConfig = async () => {
        if (!newDeltaTablePath.trim()) return;
        
        setDeltaTablePathLoading(true);
        setDeltaTablePathSuccess(false);
        
        try {
            const result = await apiCall("/api/delta-table-path-config", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ delta_table_path: newDeltaTablePath.trim() }),
            });
            
            if (result.success) {
                setDeltaTablePathConfig(prev => ({ ...prev, delta_table_path: result.delta_table_path }));
                setDeltaTablePathSuccess(true);
                setTimeout(() => setDeltaTablePathSuccess(false), 3000);
            } else {
                throw new Error(result.message || 'Failed to update delta table path');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update delta table path configuration');
        } finally {
            setDeltaTablePathLoading(false);
        }
    };

    // Cleanup blob URLs when component unmounts or files change
    useEffect(() => {
        return () => {
            selectedFiles.forEach(file => {
                if (file.previewUrl) {
                    URL.revokeObjectURL(file.previewUrl);
                }
            });
        };
    }, [selectedFiles]);

    const handleFileSelect = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) {
            // Clean up old blob URLs
            selectedFiles.forEach(file => {
                if (file.previewUrl) {
                    URL.revokeObjectURL(file.previewUrl);
                }
            });

            const fileArray = Array.from(files).map(file => ({
                file,
                name: file.name,
                size: file.size,
                type: file.type,
                isUploaded: false,
                isProcessing: false
            }));
            setSelectedFiles(fileArray);
            setActiveFileIndex(null);
            setError(null);
        }
    };

    const handleFilePreview = async (fileIndex: number) => {
        const file = selectedFiles[fileIndex];
        if (!file) return;

        setActiveFileIndex(fileIndex);

        // If preview already exists, no need to regenerate
        if (file.preview) return;

        // Generate preview for the file
        try {
            let preview = "";
            let previewUrl = "";
            
            if (file.type.startsWith('text/') || file.name.endsWith('.txt')) {
                // Text file - read content
                const text = await file.file.text();
                preview = text;
            } else if (file.type === 'application/pdf') {
                // PDF file - create blob URL for iframe preview
                const blob = new Blob([file.file], { type: 'application/pdf' });
                previewUrl = URL.createObjectURL(blob);
                preview = "PDF_PREVIEW"; // Special marker for PDF preview
            } else if (file.type.startsWith('image/')) {
                // Image file - create blob URL for image preview
                const blob = new Blob([file.file], { type: file.type });
                previewUrl = URL.createObjectURL(blob);
                preview = "IMAGE_PREVIEW"; // Special marker for image preview
            } else {
                // Other file types
                preview = `[Document - ${formatFileSize(file.size)}]

File: ${file.name}
Size: ${formatFileSize(file.size)}
Type: ${file.type}

Click the "Process" button to upload this file to UC Volume and extract its content using AI document parsing.`;
            }

            // Update the file with preview
            setSelectedFiles(prev => prev.map((f, i) => 
                i === fileIndex ? { ...f, preview, previewUrl } : f
            ));

        } catch (err) {
            setError(`Failed to preview file: ${err}`);
        }
    };

    // Function to collapse previous panels when an action is triggered
    const collapseAllPanels = () => {
        setIsFileUploadCollapsed(true);
        setIsSelectedFilesCollapsed(true);
        setIsDocumentPreviewCollapsed(true);
        setIsDeltaTableResultsCollapsed(true);
        setIsVisualizationCollapsed(true);
    };

    const handleProcessFile = async (fileIndex: number) => {
        const file = selectedFiles[fileIndex];
        if (!file) return;

        // Processing starts without collapsing panels

        // Mark as processing
        setSelectedFiles(prev => prev.map((f, i) => 
            i === fileIndex ? { ...f, isProcessing: true, processError: undefined } : f
        ));

        try {
            // Step 1: Upload to UC Volume
            const formData = new FormData();
            formData.append('files', file.file);

            const uploadResult = await apiCall("/api/upload-to-uc", {
                method: "POST",
                body: formData
            });
            const ucPath = uploadResult.uploaded_files[0]?.path;

            if (!ucPath) {
                throw new Error("Failed to get UC path from upload response");
            }

            // Update file with UC path
            setSelectedFiles(prev => prev.map((f, i) => 
                i === fileIndex ? { ...f, isUploaded: true, ucPath } : f
            ));

            // Upload complete - mark file as uploaded and not processing
            setSelectedFiles(prev => prev.map((f, i) => 
                i === fileIndex ? { 
                    ...f, 
                    isProcessing: false
                } : f
            ));

        } catch (err) {
            setSelectedFiles(prev => prev.map((f, i) => 
                i === fileIndex ? { 
                    ...f, 
                    isProcessing: false, 
                    processError: getErrorMessage(err)
                } : f
            ));
        }
    };

    const writeToDeltaTable = async (filePaths: string[]) => {
        try {
            setDeltaTableError(null); // Clear previous errors
            setDeltaTableLoading(true); // Show loading state
            console.log("Starting write operation for:", filePaths);
            
            // FIRE AND FORGET: Start the write operation but don't wait for it
            // The backend will complete in 60+ seconds, but we'll poll for results
            apiCall("/api/write-to-delta-table", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    file_paths: filePaths,
                    limit: 10
                })
            }).then(() => {
                console.log("Write operation completed in background");
            }).catch(error => {
                console.log("Write operation timeout (expected):", error.message);
            });
            
            // IMMEDIATELY show UI sections and start polling for results
            setProcessedSessionFiles(filePaths);
            setShowDeltaTableResults(true);
            setDeltaTableResults([]);
            setDeltaTableError("Processing document... This may take 1-2 minutes for large files.");
            
            console.log("Starting polling for results...");
            
            // POLL for results every 10 seconds
            const pollForResults = async (attemptCount = 0) => {
                const maxAttempts = 30; // 5 minutes of polling (30 * 10 seconds)
                
                if (attemptCount >= maxAttempts) {
                    setDeltaTableError("Processing is taking longer than expected. The operation may still be running in the background. Try refreshing in a few minutes.");
                    setDeltaTableLoading(false);
                    return;
                }
                
                try {
                    console.log(`Polling attempt ${attemptCount + 1}/${maxAttempts}`);
                    const queryResult = await apiCall("/api/query-delta-table", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            file_paths: filePaths,
                            limit: 10
                        })
                    });
                    
                    if (queryResult.success && queryResult.data && queryResult.data.length > 0) {
                        // SUCCESS: Found results!
                        setDeltaTableResults(queryResult.data);
                        setDeltaTableError(null);
                        setDeltaTableLoading(false);
                        
                        // Fetch page metadata after successful processing
                        await fetchPageMetadata(filePaths);
                        
                        console.log(`SUCCESS: Retrieved ${queryResult.data.length} results after ${attemptCount + 1} attempts`);
                        return;
                    } else {
                        // No results yet, continue polling
                        console.log(`No results yet, will retry in 10 seconds...`);
                        setTimeout(() => pollForResults(attemptCount + 1), 10000);
                    }
                    
                } catch (error) {
                    console.error(`Polling attempt ${attemptCount + 1} failed:`, error);
                    // Continue polling even if individual queries fail
                    setTimeout(() => pollForResults(attemptCount + 1), 10000);
                }
            };
            
            // Start polling immediately
            setTimeout(() => pollForResults(), 1000); // Start polling after 1 second
            
        } catch (error) {
            console.error("Error starting write operation:", error);
            setDeltaTableError("Failed to start processing operation");
            setDeltaTableLoading(false);
            setShowDeltaTableResults(false);
        } finally {
            // Don't set loading to false here - polling will handle it
        }
    };

    // Write to Delta Table - Parse uploaded files and write to delta table
    const handleWriteToDeltaTable = async () => {
        try {
            // Get all uploaded files' UC paths
            const uploadedFiles = selectedFiles.filter(file => file.isUploaded && file.ucPath);
            const filePaths = uploadedFiles.map(file => file.ucPath!);
            
            if (filePaths.length === 0) {
                throw new Error("No uploaded files found. Please upload files first.");
            }
            
            console.log("Calling writeToDeltaTable with files:", filePaths);
            
            // Call the new polling-based function - this handles everything
            await writeToDeltaTable(filePaths);
            
        } catch (error) {
            console.error("Error in handleWriteToDeltaTable:", error);
            setDeltaTableError(error instanceof Error ? error.message : String(error));
        }
    };

    const OLD_handleWriteToDeltaTable_REMOVE = async () => {
        // This is old code that should be removed
        try {
            const response = await apiCall("/api/write-to-delta-table", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    file_paths: filePaths,
                    limit: 10
                })
            });
            
            if (response.success && response.data) {
                setDeltaTableResults(response.data);
                setShowDeltaTableResults(true);
                console.log(`Successfully processed ${response.data.length} table entries`);
            } else {
                // If the operation reports failure but we can see the UI shows table data,
                // try to query the table directly as a fallback
                console.log("Write operation reported failure, but checking if table has data...");
                try {
                    const queryResponse = await apiCall("/api/query-delta-table", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            file_paths: filePaths,
                            limit: 10
                        })
                    });
                    
                    if (queryResponse.success && queryResponse.data && queryResponse.data.length > 0) {
                        console.log(`Found ${queryResponse.data.length} table entries via fallback query`);
                        setDeltaTableResults(queryResponse.data);
                        setShowDeltaTableResults(true);
                        // Clear error since we successfully recovered the data
                        setDeltaTableError(null);
                        // Log the warning to console instead of showing it as an error
                        console.warn(`Write operation reported issues (${response.message}) but recovered ${queryResponse.data.length} existing table entries.`);
                    } else {
                        setDeltaTableError(response.message || "No data returned from operation");
                        setDeltaTableResults([]);
                    }
                } catch (queryError) {
                    console.error("Fallback query also failed:", queryError);
                    setDeltaTableError(response.message || "No data returned from operation");
                    setDeltaTableResults([]);
                }
            }
            
        } catch (error) {
            console.error("Delta table write error:", error);
            
            // Handle timeout errors with user-friendly message
            let errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('504') || errorMessage.includes('timeout') || errorMessage.includes('upstream request timeout')) {
                errorMessage = "The operation is taking longer than expected. Large documents may need more time to process. Please be patient.";
            } else if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
                errorMessage = "There was a server error processing your document. Please check your file and configuration, then try again.";
            } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
                errorMessage = "Network error occurred. Please check your connection and try again.";
            }
            
            setDeltaTableError(errorMessage);
            setDeltaTableResults([]);
        } finally {
            setDeltaTableLoading(false);
        }
    };

    // Fetch page metadata 
    const fetchPageMetadata = async (filePaths: string[]) => {
        if (filePaths.length === 0) {
            setPageMetadata(null);
            return;
        }

        setPageMetadataLoading(true);
        
        try {
            const response = await apiCall("/api/page-metadata", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    file_paths: filePaths
                })
            });

            console.log("Page metadata response:", response);
            
            if (response.success) {
                setPageMetadata({
                    total_pages: response.total_pages,
                    total_elements: response.total_elements || 0,
                    pages: response.pages || []
                });
                
                // Auto-select first page if none selected and reload delta table results for that page
                if (response.total_pages > 0 && selectedPageNumber === null) {
                    const firstPageId = response.pages[0]?.page_id;
                    if (firstPageId !== undefined) {
                        setSelectedPageNumber(firstPageId); // Use actual page_id from response
                        // Reload delta table results for the first page
                        await queryDeltaTableResults(firstPageId);
                    }
                }
                
                console.log(`Loaded metadata for ${response.total_pages} pages`);
            } else {
                console.error("Failed to fetch page metadata:", response.error);
                // Set empty metadata to still show some UI
                setPageMetadata({
                    total_pages: 0,
                    total_elements: 0,
                    pages: []
                });
            }
        } catch (error) {
            console.error("Error fetching page metadata:", error);
        } finally {
            setPageMetadataLoading(false);
        }
    };

    const queryDeltaTableResults = async (pageNumber: number | null = null) => {
        console.log("Querying delta table results for files:", processedSessionFiles, "page:", pageNumber);
        
        if (processedSessionFiles.length === 0) {
            console.log("No processed files in session, skipping query");
            setDeltaTableResults([]);
            return;
        }

        setDeltaTableLoading(true);
        setDeltaTableError(null);

        try {
            const requestBody: any = {
                file_paths: processedSessionFiles,
                limit: 50
            };
            
            // Add page number filter if specified
            if (pageNumber !== null) {
                requestBody.page_number = pageNumber;
            }

            const result = await apiCall("/api/query-delta-table", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestBody)
            });

            console.log("Delta table query result:", result);
            
            if (result.success) {
                setDeltaTableResults(result.data || []);
                console.log(`Set ${result.data?.length || 0} delta table results`);
            } else {
                throw new Error(result.error || result.message || "Query failed");
            }

        } catch (error) {
            console.error("Delta table query error:", error);
            
            // Handle timeout errors with user-friendly message
            let errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('504') || errorMessage.includes('timeout') || errorMessage.includes('upstream request timeout')) {
                errorMessage = "The query is taking longer than expected. Please by patient.";
            } else if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
                errorMessage = "There was a server error querying your data. Please check your configuration and try again.";
            } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
                errorMessage = "Network error occurred. Please check your connection and try again.";
            }
            
            setDeltaTableError(errorMessage);
            setDeltaTableResults([]);
        } finally {
            setDeltaTableLoading(false);
        }
    };

    // Handle page selection change
    const handlePageSelection = async (pageNumber: number) => {
        setSelectedPageNumber(pageNumber);
        // Query delta table results for the selected page
        await queryDeltaTableResults(pageNumber);
    };

    const handleGenerateDocumentVisualizations = async (filePath: string, pageNumber: number | null = null) => {
        const pageText = pageNumber !== null ? ` for page ${pageNumber + 1}` : "";
        console.log(`Generating document visualizations for file: ${filePath}${pageText}`);
        
        setImageVisualizationLoading("generating");
        setImageVisualizationError(null);

        try {
            const requestBody: any = {
                file_path: filePath
            };
            
            // Add page number if specified
            if (pageNumber !== null) {
                requestBody.page_number = pageNumber;
            }

            const result = await apiCall("/api/visualize-page", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestBody)
            });

            if (result.success && result.visualizations) {
                // Convert the new format to the existing state format
                const formattedVisualizations: {[pageId: string]: {image_base64: string, elements: any[]}} = {};
                
                Object.entries(result.visualizations).forEach(([pageId, pageData]: [string, any]) => {
                    formattedVisualizations[pageId] = {
                        image_base64: pageData.image_base64,
                        elements: pageData.elements
                    };
                });
                
                // When visualizing a specific page, replace existing visualizations
                // When visualizing all pages (pageNumber is null), merge with existing
                if (pageNumber !== null) {
                    // Replace existing visualizations when viewing a specific page
                    setImageVisualization(formattedVisualizations);
                } else {
                    // Merge with existing visualizations when viewing all pages
                    setImageVisualization(prev => ({
                        ...(prev || {}),
                        ...formattedVisualizations
                    }));
                }
                console.log(`Successfully loaded visualizations for ${result.total_pages} pages with ${result.total_elements} total elements`);
            } else {
                throw new Error(result.message || "Failed to generate document visualizations");
            }

        } catch (error) {
            console.error("Document visualization error:", error);
            setImageVisualizationError(error instanceof Error ? error.message : String(error));
        } finally {
            setImageVisualizationLoading(null);
        }
    };

    // Zoom utility functions
    const getZoomLevel = (pageId: string): number | 'fit' => {
        return pageZoomLevels[pageId] || 'fit';
    };

    const setZoomLevel = (pageId: string, zoom: number | 'fit') => {
        if (zoom === 'fit') {
            setPageZoomLevels(prev => ({
                ...prev,
                [pageId]: 'fit'
            }));
        } else {
            const clampedZoom = Math.max(0.25, Math.min(3, zoom)); // Limit zoom between 25% and 300%
            setPageZoomLevels(prev => ({
                ...prev,
                [pageId]: clampedZoom
            }));
        }
    };

    const zoomIn = (pageId: string) => {
        const currentZoom = getZoomLevel(pageId);
        if (currentZoom === 'fit') {
            setZoomLevel(pageId, 1.25); // Start from 125% when zooming in from fit
        } else {
            setZoomLevel(pageId, currentZoom + 0.25);
        }
    };

    const zoomOut = (pageId: string) => {
        const currentZoom = getZoomLevel(pageId);
        if (currentZoom === 'fit') {
            return; // Can't zoom out from fit mode
        } else if (currentZoom <= 0.5) {
            setZoomLevel(pageId, 'fit'); // Go to fit mode when zooming out from small sizes
        } else {
            setZoomLevel(pageId, currentZoom - 0.25);
        }
    };

    const resetZoom = (pageId: string) => {
        setZoomLevel(pageId, 'fit'); // Reset to fit mode instead of 100%
    };

    const renderDeltaTableResults = () => {
        if (deltaTableLoading) {
            return (
                <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Writing to delta table and retrieving results...</span>
                </div>
            );
        }

        if (deltaTableError) {
            return (
                <div className="bg-red-50 border border-red-200 rounded p-3">
                    <div className="flex items-center mb-2">
                        <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                        <span className="font-medium text-red-700">Delta Table Error</span>
                    </div>
                    <p className="text-red-700 text-sm">{deltaTableError}</p>
                </div>
            );
        }

        if (deltaTableResults.length === 0) {
            return (
                <div className="text-center py-8 text-gray-500">
                    <Database className="mx-auto h-12 w-12 text-gray-300 mb-2" />
                    <p>No document elements found yet.</p>
                    <p className="text-sm">Upload documents and click "Write to Delta Table" to extract document elements.</p>
                    <p className="text-xs mt-2 text-gray-400">
                        Results will show data inserted into: {deltaTablePathConfig.delta_table_path}
                    </p>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                <div className="text-sm text-gray-600 mb-4">
                    Showing {deltaTableResults.length} extracted elements from delta table: {deltaTablePathConfig.delta_table_path}
                </div>
                {deltaTableResults.map((result, index) => (
                    <div key={index} className={`border rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow ${
                        hoveredElement && hoveredElement.element_id === result.element_id 
                            ? 'bg-gradient-to-r from-purple-100 to-purple-50 border-purple-300 ring-2 ring-purple-400' 
                            : 'bg-gradient-to-r from-white to-gray-50'
                    }`}>
                        {/* Enhanced Header with Better Visual Hierarchy */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-3">
                                <span className={`px-3 py-2 rounded-full text-sm font-bold shadow-sm ${
                                    result.type === 'table' ? 'bg-gradient-to-r from-green-100 to-green-200 text-green-800 border border-green-300' :
                                    result.type === 'title' ? 'bg-gradient-to-r from-red-100 to-red-200 text-red-800 border border-red-300' :
                                    result.type === 'section_header' ? 'bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800 border border-purple-300' :
                                    result.type === 'figure' ? 'bg-gradient-to-r from-pink-100 to-pink-200 text-pink-800 border border-pink-300' :
                                    result.type === 'page_header' || result.type === 'page_footer' ? 'bg-gradient-to-r from-orange-100 to-orange-200 text-orange-800 border border-orange-300' :
                                    'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 border border-blue-300'
                                }`}>
                                    {result.type || 'unknown'}
                                </span>
                                <div className="text-lg font-semibold text-gray-700">
                                    Element #{result.element_id}
                                </div>
                            </div>
                        </div>
                        
                        {/* Enhanced Metadata Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-3 bg-gray-50 rounded-lg border">
                            <div className="space-y-2">
                                <div className="flex items-center">
                                    <span className="font-medium text-sm text-gray-600 w-16">File:</span>
                                    <span className="text-sm text-gray-800 font-mono bg-white px-2 py-1 rounded border">
                                        {result.path?.split('/').pop() || 'Unknown file'}
                                    </span>
                                </div>
                                <div className="flex items-center">
                                    <span className="font-medium text-sm text-gray-600 w-16">Page:</span>
                                    <span className="text-sm text-gray-800 font-mono bg-white px-2 py-1 rounded border">
                                        {result.page_id !== undefined ? result.page_id : 'Unknown'}
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center">
                                    <span className="font-medium text-sm text-gray-600 w-20">Bbox:</span>
                                    <span className="text-xs text-gray-700 font-mono bg-white px-2 py-1 rounded border">
                                        {result.bbox && Array.isArray(result.bbox) ? `[${result.bbox.join(', ')}]` : result.bbox ? String(result.bbox) : 'Not available'}
                                    </span>
                                </div>
                                {result.description && (
                                    <div className="flex items-start">
                                        <span className="font-medium text-sm text-gray-600 w-20">Desc:</span>
                                        <span className="text-sm text-gray-800 bg-white px-2 py-1 rounded border flex-1">
                                            {result.description}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* Enhanced Content Display */}
                        <div className="mb-4">
                            <div className="flex items-center mb-2">
                                <div className="bg-green-100 rounded-full p-1 mr-2">
                                    <span className="text-green-600 text-xs">
                                        {result.type === 'table' ? '📊' : result.type === 'figure' ? '🖼️' : '📄'}
                                    </span>
                                </div>
                                <span className="font-semibold text-sm text-green-700">
                                    {result.type === 'table' ? 'Table Content' : 
                                     result.type === 'figure' ? 'Figure Description' : 'Extracted Content'}
                                </span>
                            </div>
                            
                            {result.type === 'figure' ? (
                                // For figure elements, show only description
                                <div className="bg-white p-4 rounded-lg border-l-4 border-green-400 shadow-inner">
                                    <p className="text-sm text-gray-800">
                                        {result.description || result.content || 'No description available'}
                                    </p>
                                </div>
                            ) : result.type === 'table' ? (
                                // For table elements, show both rendered table and raw HTML
                                <div className="space-y-4">
                                    {/* Rendered Table */}
                                    <div className="bg-white p-4 rounded-lg border-l-4 border-blue-400 shadow-inner">
                                        <div className="mb-2">
                                            <span className="text-xs font-medium text-gray-600">Visual Table:</span>
                                        </div>
                                        <div className="overflow-auto max-h-64 border rounded bg-gray-50 p-2">
                                            <div 
                                                dangerouslySetInnerHTML={{ __html: result.content || 'No table content available' }}
                                                className="text-sm [&_table]:border-collapse [&_table]:w-full [&_th]:border [&_th]:border-gray-300 [&_th]:p-2 [&_th]:bg-gray-100 [&_th]:font-bold [&_td]:border [&_td]:border-gray-300 [&_td]:p-2 [&_tr:nth-child(even)]:bg-white"
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* Raw HTML Content (collapsible) */}
                                    <details className="bg-white rounded-lg border-l-4 border-gray-400 shadow-inner">
                                        <summary className="p-3 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-50">
                                            View Raw HTML Content
                                        </summary>
                                        <div className="p-4 pt-0">
                                            <pre className="whitespace-pre-wrap font-mono text-xs text-gray-600 max-h-32 overflow-y-auto bg-gray-50 p-2 rounded">
                                                {result.content || 'No content available'}
                                            </pre>
                                        </div>
                                    </details>
                                </div>
                            ) : (
                                // For all other elements, show content and description
                                <div className="space-y-3">
                                    {result.description && (
                                        <div className="bg-white p-3 rounded-lg border-l-4 border-purple-400 shadow-inner">
                                            <div className="mb-1">
                                                <span className="text-xs font-medium text-gray-600">Description:</span>
                                            </div>
                                            <p className="text-sm text-gray-800">{result.description}</p>
                                        </div>
                                    )}
                                    <div className="bg-white p-4 rounded-lg border-l-4 border-green-400 shadow-inner">
                                        <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 max-h-64 overflow-y-auto">
                                            {result.content || 'No content available'}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* Enhanced Action Bar */}
                        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border">
                            <div className="text-xs text-gray-600">
                                <span className="font-semibold">AI Function:</span> ai_parse_document 
                                <span className="ml-2 text-gray-500">→</span>
                                <span className="ml-2 font-mono">{result.type}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderSummarizeResults = () => {
        if (summarizeLoading) {
            return (
                <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Generating summary...</span>
                </div>
            );
        }

        if (summarizeError) {
            return (
                <div className="bg-red-50 border border-red-200 rounded p-3">
                    <div className="flex items-center mb-2">
                        <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                        <span className="font-medium text-red-700">Summarize Error</span>
                    </div>
                    <p className="text-red-700 text-sm">{summarizeError}</p>
                </div>
            );
        }

        if (!summarizeResults) {
            return (
                <div className="text-center py-8 text-gray-500">
                    <Lightbulb className="mx-auto h-12 w-12 text-gray-300 mb-2" />
                    <p>No summary yet.</p>
                    <p className="text-sm">Click "Summarize" to generate a summary of the document.</p>
                </div>
            );
        }

        return (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
                <div className="flex items-start mb-4">
                    <div className="bg-blue-100 rounded-full p-2 mr-3 flex-shrink-0">
                        <Lightbulb className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-blue-800 mb-2">Document Summary</h3>
                        <p className="text-gray-800 leading-relaxed">
                            {summarizeResults}
                        </p>
                    </div>
                </div>
                
                <div className="bg-blue-100 rounded-lg p-4 border-l-4 border-blue-500">
                    <div className="flex items-center mb-2">
                        <span className="text-blue-700 font-semibold text-sm">💡 Powered by Databricks AI Functions</span>
                    </div>
                    <p className="text-blue-700 text-sm">
                        This summary was automatically generated using the{' '}
                        <code className="bg-blue-200 px-1 rounded text-xs">ai_summarize(content, 200)</code>{' '}
                        function. This demonstrates how you can extract key insights from documents at scale using simple SQL commands.
                    </p>
                </div>
            </div>
        );
    };

    const renderExtractResults = () => {
        if (extractLoading) {
            return (
                <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Extracting information using AI...</span>
                </div>
            );
        }

        if (extractError) {
            return (
                <div className="bg-red-50 border border-red-200 rounded p-3">
                    <div className="flex items-center mb-2">
                        <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                        <span className="font-medium text-red-700">Extract Error</span>
                    </div>
                    <p className="text-red-700 text-sm">{extractError}</p>
                </div>
            );
        }

        if (!extractResults) {
            return (
                <div className="text-center py-8 text-gray-500">
                    <FileText className="mx-auto h-12 w-12 text-gray-300 mb-2" />
                    <p>No extract results yet.</p>
                    <p className="text-sm">Add labels and click Extract to see results here.</p>
                </div>
            );
        }

        try {
            const parsed = typeof extractResults === 'string' ? JSON.parse(extractResults) : extractResults;
            
            return (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                    <div className="p-6">
                        <div className="flex items-center mb-4">
                            <div className="bg-green-100 rounded-full p-2 mr-3">
                                <FileText className="h-5 w-5 text-green-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-green-800">Extracted Information</h3>
                        </div>
                        
                        <div className="text-sm text-green-700 mb-4">
                            Extracted using enhanced ai_extract() with {labels.length} custom labels
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries(parsed).map(([key, value], index) => (
                                <div key={index} className="bg-white p-4 rounded border border-green-100">
                                    <div className="font-semibold text-sm text-green-700 mb-2 capitalize">
                                        {key.replace(/_/g, ' ')}
                                    </div>
                                    <div className="text-sm text-gray-800">
                                        {typeof value === 'string' ? value : JSON.stringify(value)}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 text-xs text-green-600 bg-green-50 rounded p-2">
                            <strong>💡 Extraction Summary:</strong> Successfully extracted {Object.keys(parsed).length} data points 
                            using AI functions. This demonstrates how custom labels can be used to extract specific information 
                            from documents at scale.
                        </div>
                    </div>
                </div>
            );
        } catch (e) {
            return (
                <div className="bg-gray-50 p-4 rounded text-xs">
                    <h5 className="font-medium text-gray-600 mb-2">Raw Extract Result:</h5>
                    <pre className="whitespace-pre-wrap text-xs overflow-x-auto">{JSON.stringify(extractResults, null, 2)}</pre>
                </div>
            );
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };


    const activeFile = activeFileIndex !== null ? selectedFiles[activeFileIndex] : null;

    // ========== Batch Mode Functions ==========

    // Function to check batch job configuration
    const checkBatchConfig = async () => {
        setBatchJobConfigLoading(true);
        try {
            // Add timestamp to prevent caching
            const timestamp = new Date().getTime();
            const data = await apiCall(`/api/batch-job-config?t=${timestamp}`, {
                method: 'GET',
                cache: 'no-store',
            });
            setBatchJobConfig(data);
        } catch (error) {
            console.error('Error loading batch job config:', error);
            setBatchJobConfig(null);
        } finally {
            setBatchJobConfigLoading(false);
        }
    };

    // Check batch job configuration on mount
    useEffect(() => {
        checkBatchConfig();
    }, []);

    const handleBatchFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const filesArray = Array.from(e.target.files);
            setBatchFiles(filesArray);
        }
    };

    const uploadAndTriggerBatchJob = async () => {
        if (batchFiles.length === 0) return;

        setBatchUploadProgress({ uploading: true, total: batchFiles.length, uploaded: 0 });

        try {
            // Step 1: Clean the batch input path before uploading
            console.log('Cleaning batch input path...');
            const cleanResult = await apiCall("/api/clean-batch-input-path", {
                method: 'POST',
            });
            console.log(`Cleaned ${cleanResult.deleted_count} existing files from batch input path`);

            // Step 2: Upload files
            const formData = new FormData();
            batchFiles.forEach((file) => {
                formData.append('files', file);
            });

            await apiCall("/api/upload-batch-pdfs", {
                method: 'POST',
                body: formData,
            });

            setBatchUploadProgress({ uploading: false, total: batchFiles.length, uploaded: batchFiles.length });

            // Trigger job
            const triggerResult = await apiCall("/api/trigger-batch-job", {
                method: 'POST',
            });

            const { run_id } = triggerResult;
            setBatchJobRunId(run_id);
            setBatchJobPolling(true);

            // Start polling for job status
            pollBatchJobStatus(run_id);
        } catch (error) {
            console.error('Error in batch processing:', error);
            const errorMsg = getErrorMessage(error);
            alert(`Failed to process batch job: ${errorMsg}`);
            setBatchUploadProgress({ uploading: false, total: 0, uploaded: 0 });
        }
    };

    const pollBatchJobStatus = async (runId: number) => {
        const pollInterval = setInterval(async () => {
            try {
                const status = await apiCall(`/api/batch-job-status/${runId}`, {
                    method: 'GET',
                });
                setBatchJobStatus(status);

                // Stop polling if terminal state (use flat structure)
                if (['SUCCESS', 'FAILED', 'CANCELED', 'TERMINATED'].includes(status.state)) {
                    clearInterval(pollInterval);
                    setBatchJobPolling(false);
                }
            } catch (error) {
                console.error('Error polling job status:', error);
            }
        }, 5000); // Poll every 5 seconds
    };

    const updateBatchJobId = async () => {
        if (!newBatchJobId.trim()) {
            alert('Please enter a job ID');
            return;
        }

        setBatchJobUpdateLoading(true);
        setBatchJobUpdateSuccess(false);

        try {
            const data = await apiCall("/api/batch-job-config", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ job_id: newBatchJobId.trim() }),
            });

            // Update the batch job config with new data
            setBatchJobConfig({
                ...batchJobConfig,
                job_id: data.job_id,
                job_name: data.job_name,
            });
            setBatchJobUpdateSuccess(true);
            setNewBatchJobId('');

            // Hide success message after 3 seconds
            setTimeout(() => setBatchJobUpdateSuccess(false), 3000);
        } catch (error) {
            console.error('Error updating batch job ID:', error);
            const errorMsg = getErrorMessage(error);
            alert(`Failed to update job ID: ${errorMsg}`);
        } finally {
            setBatchJobUpdateLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Mode Selector - Show if no mode selected */}
            {processingMode === null && (
                <div className="min-h-screen flex items-center justify-center p-8">
                    <div className="max-w-4xl w-full">
                        <div className="text-center mb-8">
                            <h1 className="text-4xl font-bold text-gray-800 mb-2">Document Intelligence</h1>
                            <p className="text-gray-600">Choose your processing mode</p>
                        </div>
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Interactive Mode Card */}
                            <div
                                onClick={() => setProcessingMode('interactive')}
                                className="bg-white rounded-lg shadow-md p-8 cursor-pointer hover:shadow-xl transition-shadow border-2 border-transparent hover:border-blue-500"
                            >
                                <div className="text-center">
                                    <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                                        <FileText className="w-8 h-8 text-blue-600" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-800 mb-3">Interactive Mode</h2>
                                    <p className="text-gray-600 mb-4">
                                        Process and visualize a single PDF document with interactive bounding box visualization
                                    </p>
                                    <ul className="text-sm text-gray-500 space-y-2 text-left">
                                        <li>✓ Upload one PDF at a time</li>
                                        <li>✓ Interactive page visualization</li>
                                        <li>✓ Immediate results</li>
                                        <li>✓ Ideal for debugging complex document parsing</li>
                                    </ul>
                                </div>
                            </div>

                            {/* Batch Mode Card */}
                            <div
                                onClick={() => setProcessingMode('batch')}
                                className="bg-white rounded-lg shadow-md p-8 cursor-pointer hover:shadow-xl transition-shadow border-2 border-transparent hover:border-green-500"
                            >
                                <div className="text-center">
                                    <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                                        <Upload className="w-8 h-8 text-green-600" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-800 mb-3">Batch Mode</h2>
                                    <p className="text-gray-600 mb-4">
                                        Process multiple PDF documents using Databricks Jobs for high-volume workflows
                                    </p>
                                    <ul className="text-sm text-gray-500 space-y-2 text-left">
                                        <li>✓ Upload multiple PDFs</li>
                                        <li>✓ Structured streaming processing</li>
                                        <li>✓ Scalable job execution</li>
                                        <li>✓ Batch results in Delta tables</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Interactive Mode - Original Main Branch Implementation */}
            {processingMode === 'interactive' && (
                <>
            {/* Value Proposition Modal */}
            {showValueModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
                        <div className="p-8">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-3xl font-bold text-blue-600 flex items-center">
                                    <FileText className="mr-3 h-8 w-8" />
                                    Databricks AI Functions: Transform Document Processing
                                </h2>
                                <button 
                                    onClick={() => setShowValueModal(false)}
                                    className="text-gray-500 hover:text-gray-700 text-2xl"
                                >
                                    ×
                                </button>
                            </div>
                            
                            <div className="space-y-6">
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border-l-4 border-blue-500">
                                    <h3 className="text-xl font-semibold mb-3 text-blue-700">🎯 The Challenge: Document Intelligence at Scale</h3>
                                    <p className="text-gray-700 leading-relaxed">
                                        Modern organizations process thousands of documents daily—PDFs, contracts, invoices, reports—requiring 
                                        complex AI workflows to extract, analyze, and understand content. Traditional approaches involve multiple 
                                        tools, APIs, and manual processing that don't scale with enterprise document volumes.
                                    </p>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="bg-red-50 p-5 rounded-lg border border-red-200">
                                        <h4 className="font-semibold text-red-700 mb-3">❌ Traditional Approach</h4>
                                        <ul className="text-sm text-red-600 space-y-2">
                                            <li>• Multiple document processing APIs</li>
                                            <li>• Complex OCR and parsing pipelines</li>
                                            <li>• Security risks with external services</li>
                                            <li>• Manual file handling and storage</li>
                                            <li>• Inconsistent extraction quality</li>
                                            <li>• Limited scalability for enterprise volumes</li>
                                        </ul>
                                    </div>
                                    
                                    <div className="bg-green-50 p-5 rounded-lg border border-green-200">
                                        <h4 className="font-semibold text-green-700 mb-3">✅ Databricks AI Functions</h4>
                                        <ul className="text-sm text-green-600 space-y-2">
                                            <li>• Simple SQL: ai_parse_document(file_path)</li>
                                            <li>• Built-in Unity Catalog file storage</li>
                                            <li>• Data never leaves your secure environment</li>
                                            <li>• Native lakehouse integration</li>
                                            <li>• Consistent, reliable AI parsing</li>
                                            <li>• Seamless scaling to thousands of documents</li>
                                        </ul>
                                    </div>
                                </div>

                                <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-lg border-l-4 border-purple-500">
                                    <h3 className="text-xl font-semibold mb-4 text-purple-700">🚀 Demo Journey: Single Document → Enterprise Scale</h3>
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div>
                                            <h4 className="font-semibold text-purple-600 mb-2">Interactive Prototype</h4>
                                            <p className="text-sm text-gray-700 mb-3">
                                                Upload any document type and see how ai_parse_document extracts structured content 
                                                with headers, footers, and intelligent parsing.
                                            </p>
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-purple-600 mb-2">Production Pipeline</h4>
                                            <p className="text-sm text-gray-700 mb-3">
                                                Scale the same workflow to process <strong>entire document libraries</strong> 
                                                with automated batch processing using Lakeflow.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-6 rounded-lg border-l-4 border-yellow-500">
                                    <h3 className="text-xl font-semibold mb-3 text-yellow-700">💰 Scale Impact</h3>
                                    <div className="grid md:grid-cols-3 gap-4 text-center">
                                        <div>
                                            <div className="text-2xl font-bold text-yellow-600">1000x</div>
                                            <div className="text-sm text-gray-600">Scale from 1 to enterprise volumes</div>
                                        </div>
                                        <div>
                                            <div className="text-2xl font-bold text-yellow-600">95%</div>
                                            <div className="text-sm text-gray-600">Less integration complexity</div>
                                        </div>
                                        <div>
                                            <div className="text-2xl font-bold text-yellow-600">Zero</div>
                                            <div className="text-sm text-gray-600">External API dependencies</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-blue-600 text-white p-6 rounded-lg">
                                    <h3 className="text-xl font-semibold mb-3">🎬 Ready to Experience Document Intelligence?</h3>
                                    <p className="mb-4">
                                        This interactive demo showcases the complete document processing journey from individual file upload 
                                        to enterprise-scale document intelligence using Databricks AI Functions.
                                    </p>
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm opacity-90">
                                            Upload documents → Parse with AI → Extract structured data → Scale to production
                                        </div>
                                        <button 
                                            onClick={() => setShowValueModal(false)}
                                            className="bg-white text-blue-600 px-6 py-2 rounded font-semibold hover:bg-gray-100 transition-colors"
                                        >
                                            Start Demo →
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="bg-white shadow-sm border-b border-gray-200">
                <div className="flex items-center justify-between px-8 py-4">
                    <button
                        onClick={() => setProcessingMode(null)}
                        className="flex items-center text-blue-600 hover:text-blue-800 font-medium"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        back to mode selection
                    </button>
                    <div className="flex items-center space-x-4">
                        <button 
                            onClick={() => setShowWarehouseConfig(!showWarehouseConfig)}
                            className="flex items-center text-gray-600 hover:text-gray-800 text-sm font-medium"
                            title="Configure Databricks Warehouse"
                        >
                            <Settings className="w-4 h-4 mr-1" />
                            Settings
                        </button>
                        <h1 className="text-xl font-semibold text-gray-800">Document Intelligence</h1>
                    </div>
                </div>
            </header>

            {/* Warehouse Configuration Section */}
            {showWarehouseConfig && (
                <div className="bg-gray-100 border-b border-gray-200 p-6">
                    <Card className="max-w-2xl mx-auto">
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <Database className="mr-2 h-5 w-5" />
                                Databricks Warehouse Configuration
                            </CardTitle>
                            <CardDescription>
                                Configure your Databricks SQL Warehouse ID for AI Functions used in document processing. Each user may have a different warehouse ID.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Current Warehouse ID
                                </label>
                                <div className="flex items-center space-x-2">
                                    <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded border flex-1 font-mono">
                                        {warehouseConfig.warehouse_id || 'Loading...'}
                                    </div>
                                    {warehouseConfig.warehouse_id !== warehouseConfig.default_warehouse_id && (
                                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">Custom</span>
                                    )}
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Update Warehouse ID
                                </label>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="text"
                                        value={newWarehouseId}
                                        onChange={(e) => setNewWarehouseId(e.target.value)}
                                        placeholder="Enter your warehouse ID (e.g., 3708ab0cd3e20acd)"
                                        className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    <Button 
                                        onClick={updateWarehouseConfig}
                                        disabled={warehouseLoading || !newWarehouseId.trim() || newWarehouseId === warehouseConfig.warehouse_id}
                                        size="sm"
                                        className="flex items-center"
                                    >
                                        {warehouseLoading ? (
                                            "Saving..."
                                        ) : (
                                            <>
                                                <Save className="w-4 h-4 mr-1" />
                                                Save
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {warehouseSuccess && (
                                <div className="flex items-center text-green-600 text-sm">
                                    <AlertCircle className="w-4 h-4 mr-2" />
                                    Warehouse ID updated successfully! Document processing AI Functions will now use the new warehouse.
                                </div>
                            )}


                            <div className="bg-blue-50 border border-blue-200 rounded p-3">
                                <h4 className="text-sm font-medium text-blue-800 mb-1">How to find your Warehouse ID:</h4>
                                <ol className="text-xs text-blue-700 space-y-1 ml-4 list-decimal">
                                    <li>Go to your Databricks workspace</li>
                                    <li>Navigate to "SQL Warehouses" in the sidebar</li>
                                    <li>Click on your warehouse name</li>
                                    <li>Copy the ID from the URL or warehouse details</li>
                                </ol>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Volume Path Configuration */}
                    <Card className="max-w-2xl mx-auto mt-4">
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <Database className="mr-2 h-5 w-5" />
                                Databricks Volume Path Configuration
                            </CardTitle>
                            <CardDescription>
                                Configure your Databricks UC Volume path for document storage and processing.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Current Volume Path
                                </label>
                                <div className="flex items-center space-x-2">
                                    <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded border flex-1 font-mono">
                                        {volumePathConfig.volume_path || 'Loading...'}
                                    </div>
                                    {volumePathConfig.volume_path !== volumePathConfig.default_volume_path && (
                                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">Custom</span>
                                    )}
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Update Volume Path
                                </label>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="text"
                                        value={newVolumePath}
                                        onChange={(e) => setNewVolumePath(e.target.value)}
                                        placeholder="Enter your volume path (e.g., /Volumes/catalog/schema/volume/)"
                                        className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    <Button 
                                        onClick={updateVolumePathConfig}
                                        disabled={volumePathLoading || !newVolumePath.trim() || newVolumePath === volumePathConfig.volume_path}
                                        size="sm"
                                        className="flex items-center"
                                    >
                                        {volumePathLoading ? (
                                            "Saving..."
                                        ) : (
                                            <>
                                                <Save className="w-4 h-4 mr-1" />
                                                Save
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {volumePathSuccess && (
                                <div className="flex items-center text-green-600 text-sm">
                                    <AlertCircle className="w-4 h-4 mr-2" />
                                    Volume path updated successfully! Document uploads will now use the new path.
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Delta Table Path Configuration */}
                    <Card className="max-w-2xl mx-auto mt-4">
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <Database className="mr-2 h-5 w-5" />
                                Databricks Delta Table Path Configuration
                            </CardTitle>
                            <CardDescription>
                                Configure your Databricks Delta table path for storing parsed document results.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Current Delta Table Path
                                </label>
                                <div className="flex items-center space-x-2">
                                    <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded border flex-1 font-mono">
                                        {deltaTablePathConfig.delta_table_path || 'Loading...'}
                                    </div>
                                    {deltaTablePathConfig.delta_table_path !== deltaTablePathConfig.default_delta_table_path && (
                                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">Custom</span>
                                    )}
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Update Delta Table Path
                                </label>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="text"
                                        value={newDeltaTablePath}
                                        onChange={(e) => setNewDeltaTablePath(e.target.value)}
                                        placeholder="Enter your delta table path (e.g., /catalog.schema.table_name)"
                                        className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    <Button 
                                        onClick={updateDeltaTablePathConfig}
                                        disabled={deltaTablePathLoading || !newDeltaTablePath.trim() || newDeltaTablePath === deltaTablePathConfig.delta_table_path}
                                        size="sm"
                                        className="flex items-center"
                                    >
                                        {deltaTablePathLoading ? (
                                            "Saving..."
                                        ) : (
                                            <>
                                                <Save className="w-4 h-4 mr-1" />
                                                Save
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {deltaTablePathSuccess && (
                                <div className="flex items-center text-green-600 text-sm">
                                    <AlertCircle className="w-4 h-4 mr-2" />
                                    Delta table path updated successfully! Parsed results will now be stored in the new table.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            <main className="flex flex-col lg:flex-row gap-8 p-8 h-[calc(100vh-120px)]">
                {/* Left Panel: File Management - 1/4 width */}
                <div className="lg:w-1/4 flex flex-col gap-4 overflow-y-auto pr-2">
                    <h2 className="text-lg font-semibold text-center">Document Processing</h2>
                    
                    {/* File Upload Card */}
                    <Card className="h-fit">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <Upload className="mr-2 h-4 w-4" />
                                    Select Document
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsFileUploadCollapsed(!isFileUploadCollapsed)}
                                    className="h-6 w-6 p-0"
                                >
                                    {isFileUploadCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                            </CardTitle>
                            {!isFileUploadCollapsed && (
                                <CardDescription className="text-sm">
                                    Select a single PDF document for interactive processing and visualization
                                </CardDescription>
                            )}
                        </CardHeader>
                        {!isFileUploadCollapsed && (
                            <CardContent className="pt-0">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    onChange={handleFileChange}
                                    className="hidden"
                                    accept=".pdf"
                                />
                                <Button onClick={handleFileSelect} className="w-full text-sm">
                                    <Upload className="mr-2 h-4 w-4" />
                                    Select PDF File
                                </Button>
                                <p className="text-xs text-gray-500 mt-2 text-center">
                                    Only one PDF at a time. For batch processing, use Batch Mode.
                                </p>
                            </CardContent>
                        )}
                    </Card>

                    {/* Selected Files Card */}
                    {selectedFiles.length > 0 && (
                        <Card className="h-fit">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <Database className="mr-2 h-4 w-4" />
                                        Selected File
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setIsSelectedFilesCollapsed(!isSelectedFilesCollapsed)}
                                        className="h-6 w-6 p-0"
                                    >
                                        {isSelectedFilesCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </Button>
                                </CardTitle>
                                {!isSelectedFilesCollapsed && (
                                    <CardDescription className="text-sm">
                                        Click to preview the file, then use Upload to upload to UC Volume
                                    </CardDescription>
                                )}
                            </CardHeader>
                            {!isSelectedFilesCollapsed && (
                                <CardContent className="space-y-2 pt-0">
                                {selectedFiles.map((file, index) => (
                                    <div 
                                        key={index} 
                                        className={`flex items-center justify-between p-3 border rounded cursor-pointer transition-colors ${
                                            activeFileIndex === index ? 'bg-blue-50 border-blue-200' : 'bg-white hover:bg-gray-50'
                                        }`}
                                    >
                                        <div 
                                            className="flex items-center flex-1 min-w-0"
                                            onClick={() => handleFilePreview(index)}
                                        >
                                            <FileText className="mr-2 h-4 w-4 flex-shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <div className="font-medium text-sm truncate">{file.name}</div>
                                                <div className="text-xs text-gray-500">
                                                    {formatFileSize(file.size)} • {file.type}
                                                    {file.isUploaded && <span className="text-green-600 ml-2">✓ Uploaded</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 ml-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleFilePreview(index)}
                                                disabled={file.isProcessing}
                                            >
                                                <Eye className="h-4 w-4" />
                                                Preview
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={() => handleProcessFile(index)}
                                                disabled={file.isProcessing || file.isUploaded}
                                                className="min-w-[80px]"
                                            >
                                                {file.isProcessing ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : file.isUploaded ? (
                                                    "Uploaded"
                                                ) : (
                                                    <>
                                                        <Upload className="h-4 w-4 mr-1" />
                                                        Upload
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                </CardContent>
                            )}
                        </Card>
                    )}



                    {/* Write to Delta Table Panel - Shows after upload like other panels */}
                    {selectedFiles.length > 0 && (
                        <Card className="h-fit bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <Database className="mr-2 h-5 w-5 text-blue-600" />
                                        Write to Delta Table
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setIsDeltaTableResultsCollapsed(!isDeltaTableResultsCollapsed)}
                                        className="h-6 w-6 p-0"
                                    >
                                        {isDeltaTableResultsCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </Button>
                                </CardTitle>
                                {!isDeltaTableResultsCollapsed && (
                                    <CardDescription className="text-sm">
                                        Parse uploaded documents with ai_parse_document to extract all document elements (text, tables, titles, etc.) and write to Delta Table for persistent storage and querying.
                                    </CardDescription>
                                )}
                            </CardHeader>
                            {!isDeltaTableResultsCollapsed && (
                                <CardContent className="space-y-3 pt-0">
                                    {selectedFiles.filter(f => f.isUploaded).length > 0 && (
                                        <div className="p-3 bg-white rounded border">
                                            <div className="text-sm font-medium text-gray-700 mb-2">
                                                Uploaded Files: {selectedFiles.filter(f => f.isUploaded).length} file(s)
                                            </div>
                                            <div className="text-xs text-gray-600 space-y-1">
                                                {selectedFiles.filter(f => f.isUploaded).slice(0, 3).map((file, i) => (
                                                    <div key={i} className="font-mono">{file.name}</div>
                                                ))}
                                                {selectedFiles.filter(f => f.isUploaded).length > 3 && (
                                                    <div className="text-gray-500">+ {selectedFiles.filter(f => f.isUploaded).length - 3} more files</div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <Button
                                        onClick={handleWriteToDeltaTable}
                                        disabled={deltaTableLoading || selectedFiles.filter(f => f.isUploaded).length === 0}
                                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
                                        size="lg"
                                    >
                                        {deltaTableLoading ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Writing to Delta Table...
                                            </>
                                        ) : (
                                            <>
                                                <Database className="h-4 w-4 mr-2" />
                                                Write to Delta Table
                                            </>
                                        )}
                                    </Button>

                                    {selectedFiles.filter(f => f.isUploaded).length === 0 && (
                                        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded text-center">
                                            Upload documents first to write to Delta Table
                                        </div>
                                    )}

                                    {deltaTableError && (
                                        <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                                            {deltaTableError}
                                        </div>
                                    )}
                                </CardContent>
                            )}
                        </Card>
                    )}

                    {/* Error Display */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded p-3 flex items-center">
                            <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                            <span className="text-red-700 text-sm">{error}</span>
                        </div>
                    )}
                </div>

                {/* Right Panel: File Preview and Results - 3/4 width */}
                <div className="lg:w-3/4 flex flex-col gap-6 overflow-y-auto pl-2">
                    <h2 className="text-xl font-semibold text-center">Preview & Results</h2>
                    
                    {/* Page Navigation Card - Shows after processing completes and we have page metadata */}
                    {pageMetadata && pageMetadata.total_pages > 0 && (
                        <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
                            <CardHeader>
                                <CardTitle className="flex items-center">
                                    <FileText className="mr-2 h-5 w-5 text-purple-600" />
                                    Page Navigation
                                </CardTitle>
                                <CardDescription>
                                    Select a page to view its elements and generate visualizations. Found {pageMetadata.total_pages} pages with {pageMetadata.total_elements || 0} total elements.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {/* Page Selector Dropdown */}
                                    <div className="flex items-center space-x-4">
                                        <label className="text-sm font-medium text-purple-700">Select Page:</label>
                                        <select
                                            value={selectedPageNumber ?? ""}
                                            onChange={(e) => {
                                                const pageNum = e.target.value === "" ? null : parseInt(e.target.value);
                                                if (pageNum !== null) {
                                                    handlePageSelection(pageNum);
                                                }
                                            }}
                                            className="px-3 py-2 border border-purple-300 rounded-md bg-white text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                            disabled={pageMetadataLoading}
                                        >
                                            <option value="">Select a page...</option>
                                            {pageMetadata.pages
                                                .sort((a, b) => parseInt(a.page_number) - parseInt(b.page_number))
                                                .map((page) => (
                                                <option key={page.page_id} value={page.page_id}>
                                                    Page {page.page_number} ({page.elements_count} elements)
                                                </option>
                                            ))}
                                        </select>
                                        
                                        {selectedPageNumber !== null && (
                                            <div className="flex items-center space-x-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        const currentIndex = pageMetadata.pages.findIndex(p => p.page_id === selectedPageNumber);
                                                        if (currentIndex > 0) {
                                                            handlePageSelection(pageMetadata.pages[currentIndex - 1].page_id);
                                                        }
                                                    }}
                                                    disabled={pageMetadata.pages.findIndex(p => p.page_id === selectedPageNumber) <= 0}
                                                    className="text-purple-600"
                                                >
                                                    ← Previous
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        const currentIndex = pageMetadata.pages.findIndex(p => p.page_id === selectedPageNumber);
                                                        if (currentIndex < pageMetadata.pages.length - 1) {
                                                            handlePageSelection(pageMetadata.pages[currentIndex + 1].page_id);
                                                        }
                                                    }}
                                                    disabled={pageMetadata.pages.findIndex(p => p.page_id === selectedPageNumber) >= pageMetadata.pages.length - 1}
                                                    className="text-purple-600"
                                                >
                                                    Next →
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Selected Page Info */}
                                    {selectedPageNumber !== null && (
                                        <div className="bg-white p-4 rounded-lg border border-purple-200">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h4 className="font-medium text-purple-800">
                                                        Page {pageMetadata.pages.find(p => p.page_id === selectedPageNumber)?.page_number}
                                                    </h4>
                                                    <p className="text-sm text-purple-600">
                                                        {pageMetadata.pages.find(p => p.page_id === selectedPageNumber)?.elements_count} elements on this page
                                                    </p>
                                                </div>
                                                <Button
                                                    onClick={async () => {
                                                        if (processedSessionFiles.length > 0 && selectedPageNumber !== null) {
                                                            // First, query delta table results for this page to ensure they show up
                                                            await queryDeltaTableResults(selectedPageNumber);
                                                            // Then generate visualizations
                                                            handleGenerateDocumentVisualizations(processedSessionFiles[0], selectedPageNumber);
                                                        }
                                                    }}
                                                    disabled={imageVisualizationLoading === "generating"}
                                                    className="bg-purple-600 hover:bg-purple-700"
                                                    size="sm"
                                                >
                                                    {imageVisualizationLoading === "generating" ? (
                                                        <>
                                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                            Visualizing...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Eye className="h-4 w-4 mr-2" />
                                                            Visualize This Page
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Delta Table Results Card - Shows first when available */}
                    {showDeltaTableResults && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <Database className="mr-2 h-5 w-5 text-blue-600" />
                                        Delta Table Results
                                        {selectedPageNumber !== null && pageMetadata && (
                                            <span className="ml-2 text-sm text-gray-500">
                                                (Page {pageMetadata.pages.find(p => p.page_id === selectedPageNumber)?.page_number})
                                            </span>
                                        )}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setIsDeltaTableResultsCollapsed(!isDeltaTableResultsCollapsed)}
                                        className="h-8 w-8 p-0"
                                    >
                                        {isDeltaTableResultsCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </Button>
                                </CardTitle>
                                {!isDeltaTableResultsCollapsed && (
                                    <CardDescription>
                                        Document elements extracted by ai_parse_document function stored in Delta table.
                                        {selectedPageNumber !== null ? " Showing elements for selected page only." : " Showing all elements."}
                                    </CardDescription>
                                )}
                            </CardHeader>
                            {!isDeltaTableResultsCollapsed && (
                                <CardContent>
                                    {renderDeltaTableResults()}
                                </CardContent>
                            )}
                        </Card>
                    )}


                    {/* Page Visualizations Card */}
                    {(Object.keys(imageVisualization || {}).length > 0 || imageVisualizationLoading) && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <Eye className="mr-2 h-5 w-5 text-purple-600" />
                                        Page Visualizations
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setIsVisualizationCollapsed(!isVisualizationCollapsed)}
                                        className="h-8 w-8 p-0"
                                    >
                                        {isVisualizationCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </Button>
                                </CardTitle>
                                {!isVisualizationCollapsed && (
                                    <CardDescription>
                                        Document pages with color-coded bounding boxes showing AI-extracted elements
                                    </CardDescription>
                                )}
                            </CardHeader>
                            {!isVisualizationCollapsed && (
                                <CardContent>
                                    {imageVisualizationLoading ? (
                                        <div className="flex items-center justify-center p-8">
                                            <Loader2 className="h-6 w-6 animate-spin mr-2" />
                                            <span>Generating page visualizations...</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            {Object.entries(imageVisualization || {}).map(([pageId, visualization]) => {
                                            const currentZoom = getZoomLevel(pageId);
                                            const displayPageNumber = parseInt(pageId) + 1; // Convert page number to start from 1
                                            
                                            return (
                                                <div key={pageId} className="border rounded-lg p-4 bg-gradient-to-r from-purple-50 to-indigo-50">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div className="flex items-center">
                                                            <div className="bg-purple-100 rounded-full p-2 mr-3">
                                                                <span className="text-purple-600 text-sm">🎯</span>
                                                            </div>
                                                            <div>
                                                                <h3 className="font-semibold text-purple-700">Page {displayPageNumber}</h3>
                                                                <p className="text-sm text-purple-600">
                                                                    {visualization.elements.length} elements with bounding boxes
                                                                </p>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Zoom Controls */}
                                                        <div className="flex items-center space-x-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => zoomOut(pageId)}
                                                                disabled={currentZoom === 'fit'}
                                                                className="h-8 w-8 p-0"
                                                            >
                                                                <span className="text-lg">−</span>
                                                            </Button>
                                                            <span className="text-sm text-purple-600 min-w-[60px] text-center">
                                                                {currentZoom === 'fit' ? 'Fit' : `${Math.round(currentZoom * 100)}%`}
                                                            </span>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => zoomIn(pageId)}
                                                                disabled={typeof currentZoom === 'number' && currentZoom >= 3}
                                                                className="h-8 w-8 p-0"
                                                            >
                                                                <span className="text-lg">+</span>
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => resetZoom(pageId)}
                                                                className="text-xs px-2"
                                                            >
                                                                Reset
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Image with zoom applied and floating tooltips */}
                                                    <div className="bg-white p-4 rounded-lg border-2 border-purple-200 shadow-inner overflow-auto" style={{ maxHeight: '600px' }}>
                                                        <FloatingTooltip 
                                                            elements={visualization.elements || []}
                                                            onElementHover={setHoveredElement}
                                                        >
                                                            <img 
                                                                src={`data:image/png;base64,${visualization.image_base64}`}
                                                                alt={`Page ${displayPageNumber} with bounding boxes`}
                                                                className={`rounded-lg border shadow-sm transition-all duration-200 ${
                                                                    currentZoom === 'fit' ? 'max-w-full max-h-full w-auto h-auto mx-auto' : ''
                                                                }`}
                                                                style={currentZoom === 'fit' ? {
                                                                    objectFit: 'contain'
                                                                } : { 
                                                                    transform: `scale(${currentZoom})`,
                                                                    transformOrigin: 'top left',
                                                                    maxWidth: 'none'
                                                                }}
                                                            />
                                                        </FloatingTooltip>
                                                    </div>
                                                    
                                                    <div className="mt-3 text-center space-y-2">
                                                        <div className="inline-flex items-center text-sm text-purple-700 bg-purple-100 px-3 py-1 rounded-full">
                                                            <span className="font-medium">
                                                                Color Legend: 
                                                            </span>
                                                            <span className="ml-2 text-xs">
                                                                🔵 Text • 🔴 Title • 🟣 Section Header • 🟢 Table • 🟡 Figure • 🟠 Footer/Header
                                                            </span>
                                                        </div>
                                                        {hoveredElement && (
                                                            <div className="inline-flex items-center text-sm text-white bg-purple-600 px-3 py-1 rounded-full animate-pulse">
                                                                <span className="font-medium">
                                                                    📍 Hovering: {hoveredElement.type} #{hoveredElement.element_id}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div className="text-xs text-purple-600 mt-1">
                                                            💡 Hover over bounding boxes to see element details
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        
                                        {/* Clear all visualizations button */}
                                        <div className="text-center pt-4 border-t">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setImageVisualization({})}
                                                className="text-purple-600 border-purple-200 hover:bg-purple-50"
                                            >
                                                Clear All Visualizations
                                            </Button>
                                        </div>
                                        </div>
                                    )}
                                </CardContent>
                            )}
                        </Card>
                    )}

                    {/* Image visualization error display */}
                    {imageVisualizationError && (
                        <Card className="border-red-200">
                            <CardContent className="pt-6">
                                <div className="bg-red-50 border border-red-200 rounded p-3">
                                    <div className="flex items-center mb-2">
                                        <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                                        <span className="font-medium text-red-700">Image Visualization Error</span>
                                    </div>
                                    <p className="text-red-700 text-sm">{imageVisualizationError}</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* File Preview Card */}
                    <Card className="flex-1">
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <Eye className="mr-2 h-5 w-5" />
                                    Document Preview
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsDocumentPreviewCollapsed(!isDocumentPreviewCollapsed)}
                                    className="h-8 w-8 p-0"
                                >
                                    {isDocumentPreviewCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                            </CardTitle>
                            {!isDocumentPreviewCollapsed && (
                                <CardDescription>
                                    {activeFile ? `Previewing: ${activeFile.name}` : "Select a file to preview its content"}
                                </CardDescription>
                            )}
                        </CardHeader>
                        {!isDocumentPreviewCollapsed && (
                            <CardContent>
                                {activeFile?.preview ? (
                                    <div className="w-full h-[600px]">
                                        {activeFile.preview === "PDF_PREVIEW" && activeFile.previewUrl ? (
                                            <iframe
                                                src={activeFile.previewUrl}
                                                className="w-full h-full border rounded"
                                                title={`Preview of ${activeFile.name}`}
                                            />
                                        ) : activeFile.preview === "IMAGE_PREVIEW" && activeFile.previewUrl ? (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-50 border rounded">
                                                <img
                                                    src={activeFile.previewUrl}
                                                    alt={`Preview of ${activeFile.name}`}
                                                    className="max-w-full max-h-full object-contain"
                                                />
                                            </div>
                                        ) : (
                                            <div className="bg-gray-50 p-4 rounded border h-full overflow-y-auto">
                                                <pre className="text-sm whitespace-pre-wrap font-mono">{activeFile.preview}</pre>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-[600px] text-gray-500">
                                        <div className="text-center">
                                            <FileText className="mx-auto h-12 w-12 text-gray-300 mb-2" />
                                            <p>Select a file to preview its content</p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        )}
                    </Card>


                </div>
            </main>
                </>
            )}

            {/* Batch Mode UI */}
            {processingMode === 'batch' && (
                <div className="min-h-screen">
                    {/* Header */}
                    <header className="bg-white shadow-sm border-b border-gray-200">
                        <div className="flex items-center justify-between px-8 py-4">
                            <button
                                onClick={() => setProcessingMode(null)}
                                className="flex items-center text-blue-600 hover:text-blue-800 font-medium"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                back to mode selection
                            </button>
                            <h1 className="text-xl font-semibold text-gray-800">Batch Processing Mode</h1>
                        </div>
                    </header>

                    {/* Main Content */}
                    <main className="max-w-6xl mx-auto p-8">
                        <Card>
                            <CardHeader>
                                <CardTitle>Batch PDF Processing</CardTitle>
                                <CardDescription>
                                    Upload multiple PDFs and trigger asynchronous processing using Databricks Jobs
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Job Configuration Status */}
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="font-semibold">Job Configuration</h3>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={checkBatchConfig}
                                                disabled={batchJobConfigLoading}
                                                className="text-xs text-gray-600 hover:text-gray-800 font-medium flex items-center gap-1"
                                                title="Refresh configuration from backend"
                                            >
                                                <RefreshCw className={`w-3 h-3 ${batchJobConfigLoading ? 'animate-spin' : ''}`} />
                                                Refresh
                                            </button>
                                            <button
                                                onClick={() => setShowBatchJobConfig(!showBatchJobConfig)}
                                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                            >
                                                {showBatchJobConfig ? 'Hide Settings' : 'Update Job ID'}
                                            </button>
                                        </div>
                                    </div>

                                    {batchJobConfigLoading ? (
                                        <p className="text-sm text-gray-600">Loading job configuration...</p>
                                    ) : batchJobConfig?.job_deployed ? (
                                        <div className="text-sm space-y-1">
                                            <p className="text-green-600 font-medium">✓ Batch job is configured and deployed</p>
                                            <p className="text-gray-600">Job ID: {batchJobConfig.job_id}</p>
                                            <p className="text-gray-600">Job Name: {batchJobConfig.job_name}</p>
                                            <p className="text-gray-600">Input Volume: {batchJobConfig.input_volume_path}</p>
                                        </div>
                                    ) : (
                                        <div className="text-sm space-y-2">
                                            <p className="text-red-600">⚠ Batch job is not configured or not deployed</p>
                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-gray-700">
                                                <p className="font-semibold text-blue-900 mb-2">To deploy the Asset Bundle:</p>
                                                <p className="text-gray-600 mb-2 italic">Note: The asset bundle is included in the project repository. Ensure you have cloned the repo before proceeding.</p>
                                                <ol className="list-decimal list-inside space-y-1 ml-2">
                                                    <li>Navigate to the <code className="bg-white px-1 py-0.5 rounded font-mono text-xs">unstructured_workflow</code> directory</li>
                                                    <li>Run: <code className="bg-white px-1 py-0.5 rounded font-mono text-xs">databricks bundle validate --profile YOUR_PROFILE</code></li>
                                                    <li>Deploy: <code className="bg-white px-1 py-0.5 rounded font-mono text-xs">databricks bundle deploy --profile YOUR_PROFILE</code></li>
                                                    <li>The app will automatically detect the deployed job by name</li>
                                                    <li>If needed, you can manually enter the Job ID using "Update Job ID" button above</li>
                                                </ol>
                                                <p className="mt-2 text-blue-800">
                                                    See <code className="bg-white px-1 py-0.5 rounded font-mono text-xs">unstructured_workflow/CLAUDE.md</code> for detailed instructions.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Job ID Update Section */}
                                    {showBatchJobConfig && (
                                        <div className="mt-4 pt-4 border-t border-gray-200">
                                            <h4 className="text-sm font-medium text-gray-700 mb-2">Update Batch Job ID</h4>
                                            <p className="text-xs text-gray-500 mb-3">
                                                Enter the Databricks Job ID for batch processing. You can find this in your Databricks workspace under Workflows → Jobs.
                                            </p>
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="text"
                                                    value={newBatchJobId}
                                                    onChange={(e) => setNewBatchJobId(e.target.value)}
                                                    placeholder="Enter Job ID (e.g., 538604830129533)"
                                                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                />
                                                <Button
                                                    onClick={updateBatchJobId}
                                                    disabled={batchJobUpdateLoading || !newBatchJobId.trim()}
                                                    size="sm"
                                                    className="flex items-center"
                                                >
                                                    {batchJobUpdateLoading ? (
                                                        "Saving..."
                                                    ) : (
                                                        <>
                                                            <Save className="w-4 h-4 mr-1" />
                                                            Save
                                                        </>
                                                    )}
                                                </Button>
                                            </div>

                                            {batchJobUpdateSuccess && (
                                                <div className="flex items-center text-green-600 text-sm mt-2">
                                                    <AlertCircle className="w-4 h-4 mr-2" />
                                                    Job ID updated successfully! The new job will be used for batch processing.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* File Upload Section */}
                                {batchJobConfig && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Select PDF Files
                                            </label>
                                            <input
                                                ref={batchFileInputRef}
                                                type="file"
                                                accept=".pdf"
                                                multiple
                                                onChange={handleBatchFileSelect}
                                                className="block w-full text-sm text-gray-500
                                                    file:mr-4 file:py-2 file:px-4
                                                    file:rounded-md file:border-0
                                                    file:text-sm file:font-semibold
                                                    file:bg-blue-50 file:text-blue-700
                                                    hover:file:bg-blue-100
                                                    cursor-pointer"
                                            />
                                            {batchFiles.length > 0 && (
                                                <p className="mt-2 text-sm text-gray-600">
                                                    {batchFiles.length} file(s) selected
                                                </p>
                                            )}
                                        </div>

                                        {/* Upload Progress */}
                                        {batchUploadProgress.uploading && (
                                            <div className="bg-blue-50 p-4 rounded-lg">
                                                <p className="text-sm font-medium text-blue-700 mb-1">
                                                    Uploading files... {batchUploadProgress.uploaded} / {batchUploadProgress.total}
                                                </p>
                                                {batchJobConfig?.input_volume_path && (
                                                    <p className="text-xs text-blue-600 font-mono">
                                                        Uploading to: {batchJobConfig.input_volume_path}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {/* Upload and Trigger Button */}
                                        <button
                                            onClick={uploadAndTriggerBatchJob}
                                            disabled={batchFiles.length === 0 || batchUploadProgress.uploading || batchJobPolling}
                                            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                        >
                                            {batchUploadProgress.uploading ? 'Uploading...' : batchJobPolling ? 'Job Running...' : 'Upload and Start Batch Processing'}
                                        </button>

                                        {/* Job Status */}
                                        {batchJobRunId && batchJobStatus && (
                                            <div className="bg-gray-50 p-4 rounded-lg">
                                                <h3 className="font-semibold mb-2">Job Status</h3>
                                                <div className="text-sm space-y-1">
                                                    <p>Run ID: {batchJobRunId}</p>
                                                    <p>State: <span className={`font-medium ${
                                                        batchJobStatus.state === 'SUCCESS' ? 'text-green-600' :
                                                        batchJobStatus.state === 'FAILED' ? 'text-red-600' :
                                                        'text-blue-600'
                                                    }`}>{batchJobStatus.state || 'N/A'}</span></p>
                                                    <p>Result State: {batchJobStatus.result_state || 'N/A'}</p>
                                                    {batchJobStatus.run_page_url && (
                                                        <a
                                                            href={batchJobStatus.run_page_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-600 hover:underline"
                                                        >
                                                            View in Databricks →
                                                        </a>
                                                    )}
                                                    {batchJobStatus.tasks && batchJobStatus.tasks.length > 0 && (
                                                        <div className="mt-3">
                                                            <p className="font-medium mb-1">Tasks:</p>
                                                            <ul className="space-y-1 ml-4">
                                                                {(() => {
                                                                    // Sort tasks in workflow execution order
                                                                    const taskOrder = ['clean_pipeline_tables', 'parse_documents', 'extract_content'];
                                                                    const sortedTasks = [...batchJobStatus.tasks].sort((a, b) => {
                                                                        const indexA = taskOrder.indexOf(a.task_key);
                                                                        const indexB = taskOrder.indexOf(b.task_key);
                                                                        // If task not in order array, put it at the end
                                                                        const orderA = indexA === -1 ? 999 : indexA;
                                                                        const orderB = indexB === -1 ? 999 : indexB;
                                                                        return orderA - orderB;
                                                                    });

                                                                    return sortedTasks.map((task: any, idx: number) => {
                                                                        const formattedState = formatStateName(task.state || 'N/A');
                                                                        const duration = calculateDuration(task.start_time, task.end_time);
                                                                        return (
                                                                            <li key={idx} className="text-sm">
                                                                                {task.task_key}: <span className={`font-medium ${
                                                                                    task.state === 'SUCCESS' || task.state === 'TERMINATED' ? 'text-green-600' :
                                                                                    task.state === 'FAILED' ? 'text-red-600' :
                                                                                    'text-blue-600'
                                                                                }`}>{formattedState}</span>
                                                                                {duration && <span className="text-gray-500 ml-2">({duration})</span>}
                                                                            </li>
                                                                        );
                                                                    });
                                                                })()}
                                                            </ul>
                                                        </div>
                                                    )}

                                                    {/* Output Tables Display */}
                                                    {batchJobStatus.output_tables && batchJobStatus.output_tables.length > 0 && (
                                                        <div className="mt-3">
                                                            <p className="font-medium mb-1">Output Tables:</p>
                                                            <ul className="space-y-1 ml-4">
                                                                {batchJobStatus.output_tables.map((table: string, idx: number) => (
                                                                    <li key={idx} className="text-sm font-mono text-blue-600">
                                                                        {table}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </main>
                </div>
            )}
        </div>
    );
} 