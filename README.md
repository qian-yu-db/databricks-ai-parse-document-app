# AI Document Intelligence Demo

A full-stack Databricks application that demonstrates the power of AI Functions for document intelligence, featuring automated document parsing, structured data extraction, and interactive visualization of detected elements.

## 🌟 Key Features

### Document Processing
- **Upload & Parse**: Drag-and-drop document upload with automatic processing using Databricks AI Functions (`ai_parse_document` v2.0)
- **Multi-Page Support**: Handle complex documents with multiple pages and automatic page detection
- **Structured Data Extraction**: Extract text, tables, headers, and other document elements with bounding box coordinates
- **Delta Table Storage**: Store processed data in Databricks Delta tables for analytics and querying

### Interactive Visualization
- **Bounding Box Overlay**: Color-coded visualization of detected document elements
- **Zoom Controls**: Interactive zoom functionality for detailed document inspection
- **Page Navigation**: Intuitive page selector with Previous/Next navigation
- **Element Filtering**: View specific types of detected elements (text, tables, headers, etc.)

### Configuration Management
- **Dynamic Configuration**: Real-time configuration of warehouse ID, UC Volume paths, and Delta table paths
- **Environment Flexibility**: Support for development, staging, and production environments
- **Automatic Detection**: Smart API endpoint detection for Databricks Apps environment

## 🏗️ Architecture

### Frontend (Next.js 15)
- **Framework**: Next.js with TypeScript and static export for Databricks Apps
- **UI**: Modern responsive design using Tailwind CSS v4 and Radix UI components
- **State Management**: React hooks with comprehensive state tracking
- **API Client**: Robust API communication with fallback URL strategies

### Backend (FastAPI)
- **API Framework**: FastAPI with automatic OpenAPI documentation
- **Databricks Integration**: Native integration with Databricks SDK and AI Functions
- **Image Processing**: PIL-based visualization generation with color-coded bounding boxes
- **Static Serving**: Serves Next.js frontend while providing API endpoints

### Data Pipeline
1. **Document Upload** → UC Volumes via Databricks Files API
2. **AI Processing** → Extract structured data using `ai_parse_document`
3. **Data Storage** → Store results in Delta tables with full schema
4. **Visualization** → Generate interactive bounding box overlays
5. **Query & Display** → Real-time data retrieval and frontend visualization

## 🚀 Quick Start

### Prerequisites
- Databricks workspace with AI Functions enabled
- SQL warehouse for AI Functions execution
- UC Volume for document storage
- Delta table for data storage

### Local Development

#### Frontend Development
```bash
cd frontend
npm install
npm run dev        # Development server at http://localhost:3000
npm run build      # Build for production
npm run lint       # Code linting
```

#### Backend Development
```bash
cd backend
pip install -r requirements.txt
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

### Deployment to Databricks Apps

```bash
# Deploy with default settings
./deploy.sh

# Deploy with custom configuration
./deploy.sh "/custom/workspace/path" "custom-app-name"
```

The deployment script will:
1. Build the frontend with static export
2. Upload static files to your Databricks workspace
3. Package and deploy the backend
4. Configure the Databricks App

## 📡 API Endpoints

### Configuration APIs
- `GET/POST /api/warehouse-config` - Manage SQL warehouse configuration
- `GET/POST /api/volume-path-config` - Configure UC Volume paths
- `GET/POST /api/delta-table-path-config` - Set Delta table paths

### Document Processing APIs
- `POST /api/upload-to-uc` - Upload documents to UC Volumes
- `POST /api/write-to-delta-table` - Process documents with AI Functions
- `POST /api/query-delta-table` - Query processed document data
- `POST /api/page-metadata` - Get document page information

### Visualization APIs
- `POST /api/visualize-page` - Generate bounding box visualizations

## 📊 Data Schema

Documents are processed and stored with the following schema:

```sql
path: STRING                    -- Document file path
element_id: STRING             -- Unique element identifier  
type: STRING                   -- Element type (text, table, header, etc.)
bbox: ARRAY<DOUBLE>            -- Bounding box coordinates [x1, y1, x2, y2]
page_id: INT                   -- Page number
content: STRING                -- Extracted text content
description: STRING            -- AI-generated element description
image_uri: STRING              -- Associated image URI
```

## 🛠️ Configuration

### Environment Variables
```bash
DATABRICKS_WAREHOUSE_ID=your-warehouse-id
DATABRICKS_VOLUME_PATH=/Volumes/catalog/schema/volume/
DATABRICKS_DELTA_TABLE_PATH=catalog.schema.table_name
NEXT_PUBLIC_API_URL=https://your-databricks-app-url
```

### App Configuration (`backend/app.yaml`)
```yaml
command: ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
runtime: python_3.10
env:
  - name: "DATABRICKS_WAREHOUSE_ID"
    value: "your-warehouse-id"
  - name: "DATABRICKS_VOLUME_PATH" 
    value: "/Volumes/main/default/ai_functions_demo"
  - name: "DATABRICKS_DELTA_TABLE_PATH"
    value: "main.default.ai_functions_demo_documents"
```

## 📁 Project Structure

```
ai_parse_document_databricks_app/
├── frontend/                   # Next.js frontend application
│   ├── src/
│   │   ├── app/               # Next.js App Router pages
│   │   ├── components/        # Reusable UI components
│   │   └── lib/               # Utilities and API configuration
│   ├── package.json
│   └── next.config.ts
├── backend/                   # FastAPI backend application
│   ├── app.py                # Main FastAPI application
│   ├── app.yaml              # Databricks App configuration
│   ├── requirements.txt      # Python dependencies
│   └── image_utils.py        # Image processing utilities
├── deploy.sh                 # Deployment script
├── CLAUDE.md                 # Development guidelines
└── README.md                 # This file
```

## 🔧 Development

### Key Development Patterns
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Loading States**: Visual feedback for all async operations
- **Responsive Design**: Mobile-friendly interface with adaptive layouts
- **Accessibility**: Proper ARIA labels and keyboard navigation
- **Performance**: Optimized image loading and efficient state management

### Code Quality
- TypeScript for type safety
- ESLint for code quality
- Tailwind CSS for consistent styling
- Component composition with Radix UI primitives

## 🤝 Contributing

1. Follow the existing code patterns and conventions
2. Test frontend builds before deployment (`npm run build`)
3. Use the TodoWrite tool for tracking multi-step tasks
4. Ensure proper error handling and loading states
5. Sort data numerically (not as strings) where appropriate

## 📄 License

This project is part of Databricks' AI Functions demonstration and is intended for educational and demonstration purposes.

## ⚠️ Known Limitations

### Single File Processing
- **One PDF at a time**: The application currently processes only **one PDF file at a time** (backend/app.py:284-286)
- **Table overwrite**: Processing a new document will **completely overwrite** the Delta table, removing all previously processed data (backend/app.py:382-397)
- **Workaround**: If you need to maintain multiple processed documents, consider:
  - Using a different Delta table for each document
  - Manually backing up the Delta table before processing new documents
  - Modifying the backend to support append mode instead of overwrite mode

### Future Enhancements
- Multi-file batch processing support
- Append mode for Delta table operations
- Document version management and history tracking

## 🆘 Support

For issues or questions:
1. Check the logs in your Databricks workspace
2. Verify your warehouse, volume, and table configurations
3. Ensure AI Functions are enabled in your workspace
4. Review the deployment script output for any errors

---

**Built with ❤️ using Databricks AI Functions**