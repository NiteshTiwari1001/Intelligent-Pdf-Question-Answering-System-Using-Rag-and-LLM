# 🤖 Smart Research - AI-Powered PDF Chat Application

A modern Retrieval-Augmented Generation (RAG) application that enables intelligent conversations with PDF documents. Built with Next.js, Node.js, and Google Gemini AI, this application provides accurate, context-aware answers by linking each chat session to a specific document, preventing AI hallucinations.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)
![Next.js](https://img.shields.io/badge/next.js-15.4.3-black)

---

## ✨ Features

### 🎯 Core Functionality
- **PDF Upload & Processing** - Upload PDF documents for AI-powered analysis
- **Intelligent Chat** - Ask questions and get accurate answers with source citations
- **Document-Linked Sessions** - Each chat session is tied to one document to ensure accuracy
- **Source Citations** - View exact page numbers and text excerpts for every answer
- **Chat History** - Browse and resume previous conversations

### 🔒 Architecture Highlights
- **Vector Search** - Qdrant vector database for semantic similarity search
- **RAG Pipeline** - Retrieval-Augmented Generation for factual responses
- **Batch Processing** - BullMQ worker for efficient PDF vectorization
- **Real-time Updates** - Live document processing status
- **Session Management** - MongoDB for persistent chat history

### 🎨 User Experience
- **Modern UI** - Beautiful, responsive interface with Tailwind CSS
- **Dark Mode** - Full dark mode support
- **Smooth Animations** - Framer Motion for fluid interactions
- **Mobile Responsive** - Works seamlessly on all devices
- **Interactive Sources** - Click citations to view full context in modal

---

## 🏗️ Tech Stack

### Frontend
- **Next.js 15.4.3** - React framework with App Router
- **React 19** - UI library
- **Redux Toolkit** - State management
- **Tailwind CSS** - Utility-first styling
- **Framer Motion** - Animation library
- **Lucide React** - Icon library

### Backend
- **Node.js** - Runtime environment
- **Express** - Web server framework
- **MongoDB** - Document database (sessions, messages, metadata)
- **Qdrant** - Vector database (document embeddings)
- **BullMQ** - Job queue for PDF processing
- **Redis** - Message broker for BullMQ

### AI & ML
- **Google Gemini 2.5 Flash** - Large language model
- **LangChain** - AI application framework
- **Google Generative AI Embeddings** - text-embedding-004 model
- **PDF-Parse** - PDF document loader

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18.0.0 or higher ([Download](https://nodejs.org/))
- **MongoDB** 6.0+ ([Download](https://www.mongodb.com/try/download/community) or use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas))
- **Redis** 7.0+ ([Download](https://redis.io/download) or use Docker)
- **Docker** (for Qdrant) ([Download](https://www.docker.com/products/docker-desktop))
- **Google Gemini API Key** ([Get Free Key](https://makersuite.google.com/app/apikey))

---

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/smart-research.git
cd smart-research
```

### 2. Install Dependencies

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 3. Set Up Environment Variables

Create `.env` file in the `server/` directory:

```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/smart-research

# Google Gemini API Key (Get from https://makersuite.google.com/app/apikey)
GEMINI_API_KEY=your_gemini_api_key_here

# Redis Configuration (default)
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 4. Start Required Services

#### Start Qdrant Vector Database (Docker)
```bash
docker run -p 6333:6333 -v $(pwd)/qdrant_data:/qdrant/storage qdrant/qdrant
```

#### Start MongoDB (if running locally)
```bash
# macOS/Linux
mongod --dbpath ~/data/db

# Windows
mongod --dbpath C:\data\db
```

#### Start Redis (if running locally)
```bash
redis-server
```

### 5. Initialize Qdrant Collection

The collection will be created automatically on first use, but you can manually create it:

```bash
curl -X PUT 'http://localhost:6333/collections/pdf_docs' \
-H 'Content-Type: application/json' \
-d '{
  "vectors": {
    "size": 768,
    "distance": "Cosine"
  }
}'
```

### 6. Start the Application

Open **3 terminals**:

**Terminal 1 - Backend Server:**
```bash
cd server
npm run dev
```

**Terminal 2 - Background Worker:**
```bash
cd server
npm run worker
```

**Terminal 3 - Frontend:**
```bash
cd client
npm run dev
```

### 7. Open the Application

Visit **http://localhost:3000** in your browser

---

## 📖 Usage Guide

### Uploading a PDF

1. Click the **"Upload PDF"** button in the left panel
2. Select a PDF file (max 50MB)
3. Wait for processing (typically 1-2 minutes per 100 pages)
4. Status will change from "Processing" to "Ready"

### Starting a Chat

1. Click **"Start Chat"** on a processed document
2. A new chat session will be created
3. Type your question in the input box
4. Press **Enter** to send (Shift+Enter for new line)

### Viewing Sources

1. Answers include numbered sources at the bottom
2. Click **"X Sources"** to expand the list
3. Click any source card to view full context in a modal
4. Copy source text using the copy button

### Managing Chats

- **New Chat** - Click "New Chat" button to start fresh
- **Resume Chat** - Click any previous chat in the right sidebar
- **Delete Chat** - Hover over a chat and click the delete icon

---

## 🏛️ Architecture

### System Overview

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Next.js   │─────▶│   Express    │─────▶│   MongoDB   │
│  (Frontend) │      │   (Backend)  │      │  (Sessions) │
└─────────────┘      └──────────────┘      └─────────────┘
                            │
                            ├─────▶ Qdrant (Vectors)
                            │
                            ├─────▶ BullMQ (Jobs)
                            │
                            └─────▶ Gemini AI (LLM)
```

### RAG Pipeline Flow

1. **Document Upload** → PDF uploaded via Multer
2. **Job Queue** → BullMQ queues processing job
3. **PDF Parsing** → LangChain PDFLoader extracts text
4. **Text Chunking** → RecursiveCharacterTextSplitter (1500 chars)
5. **Embedding** → Google text-embedding-004 generates vectors
6. **Storage** → Qdrant stores vectors with metadata
7. **Query** → User asks question
8. **Retrieval** → Vector similarity search (top 10 chunks)
9. **Generation** → Gemini 2.5 Flash generates answer
10. **Response** → Answer with source citations returned

### Data Models

#### Document Schema (MongoDB)
```javascript
{
  filename: String,
  filepath: String,
  fileSize: Number,
  status: 'processing' | 'completed' | 'failed',
  pageCount: Number,
  chunkCount: Number,
  uploadDate: Date
}
```

#### Chat Session Schema (MongoDB)
```javascript
{
  sessionId: String,
  documentId: ObjectId,
  title: String,
  createdAt: Date,
  lastActivity: Date
}
```

#### Chat Message Schema (MongoDB)
```javascript
{
  sessionId: String,
  role: 'user' | 'assistant',
  message: String,
  sources: [{
    filename: String,
    page: Number,
    text: String,
    score: Number
  }],
  timestamp: Date
}
```

---

## 🔌 API Reference

### Documents

#### Upload PDF
```http
POST /upload/pdf
Content-Type: multipart/form-data

Body: { pdf: File }

Response: {
  message: String,
  documentId: String,
  filename: String,
  size: Number
}
```

#### Get All Documents
```http
GET /documents

Response: {
  documents: Array
}
```

#### Delete Document
```http
DELETE /documents/:id
```

### Chat Sessions

#### Create Session
```http
POST /chat/session
Body: { documentId: String }

Response: {
  sessionId: String,
  documentId: String,
  documentName: String
}
```

#### Get All Sessions
```http
GET /chat/sessions
```

#### Get Session Messages
```http
GET /chat/session/:sessionId/messages
```

#### Delete Session
```http
DELETE /chat/session/:sessionId
```

### Chat

#### Send Message
```http
POST /chat
Body: {
  query: String,
  sessionId: String
}

Response: {
  answer: String,
  sources: Array,
  timestamp: String
}
```

---

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/smart-research` | Yes |
| `GEMINI_API_KEY` | Google Gemini API key | - | Yes |
| `REDIS_HOST` | Redis server host | `localhost` | No |
| `REDIS_PORT` | Redis server port | `6379` | No |

### Tuning Parameters

#### PDF Processing (worker.js)
```javascript
chunkSize: 1500           // Characters per chunk
chunkOverlap: 200         // Overlap between chunks
maxConcurrency: 5         // Parallel embedding requests
BATCH_SIZE: 50            // Chunks per vector batch
```

#### Vector Search (index.js)
```javascript
searchLimit: 100          // Initial vector search results
topK: 10                  // Final chunks sent to AI
```

---

## 🐳 Docker Deployment

### docker-compose.yml

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:6
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  qdrant:
    image: qdrant/qdrant
    ports:
      - "6333:6333"
    volumes:
      - qdrant_data:/qdrant/storage

volumes:
  mongodb_data:
  qdrant_data:
```

### Running with Docker

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

---

## 🔧 Troubleshooting

### Common Issues

#### PDF Processing Fails
- Check worker logs
- Verify Qdrant is running: `curl http://localhost:6333/health`
- Ensure GEMINI_API_KEY is valid

#### Rate Limit Errors
- Wait 60 seconds for quota reset
- Generate new API key at https://makersuite.google.com

#### No Search Results
- Verify document status is "completed"
- Check Qdrant collection exists
- Re-upload and reprocess document

---

## 📜 License

This project is licensed under the MIT License.

---

## 📚 Research Publication

This project is based on the research paper:

"INTELLIGENT PDF QUESTION ANSWERING SYSTEM USING RAG AND LARGE LANGUAGE MODELS"

Published in:
Journal of Science, Computing and Engineering Research (JSCER), Volume-9, Issue-3, March 2026

Authors:
J.R. Arun Kumar (Project Guide),
Nitesh Tiwari (Project Lead),
Suyash Pradhan,
Neeraj Sharma,
Divyanshu Airan,
Vinay Saini

© 2026 Authors

This research work is licensed under the Creative Commons Attribution 4.0 International (CC BY 4.0) License.

You are free to use, share, and adapt the material with proper attribution to the original authors.

---

## 🙏 Acknowledgments

- **Google Gemini** - AI language model
- **LangChain** - AI application framework
- **Qdrant** - Vector database
- **Next.js** - React framework

---

Made with ❤️ by the Smart Research Team
