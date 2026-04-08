require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { Queue } = require('bullmq');
const path = require('path');
const fs = require('fs').promises;
const mongoose = require('mongoose');
const { GoogleGenAI } = require('@google/genai');

const { Document, ChatSession, ChatMessage } = require('./models');
const { createEmbeddings, getVectorStore } = require('./vectorStore');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-research');
    console.log('📊 MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const queue = new Queue("file_uplode", {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
  }
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, `${uniqueSuffix}-${file.originalname}`)
  }
})

const upload = multer({ storage: storage })

app.get('/', (req, res) => {
  res.json({ message: 'RAG API Server', status: 'running', version: '2.0.0' });
});

app.post('/upload/pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const stats = await fs.stat(req.file.path);
    
    const document = new Document({
      filename: req.file.originalname,
      filepath: req.file.path,
      fileSize: stats.size,
      status: 'processing'
    });

    await document.save();

    await queue.add("file_added", JSON.stringify({
      documentId: document._id.toString(),
      filename: req.file.originalname,
      destination: req.file.destination,
      path: req.file.path
    }));

    return res.json({ 
      message: 'File uploaded successfully',
      documentId: document._id,
      filename: req.file.originalname,
      size: stats.size
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Upload failed', details: error.message });
  }
});

app.get('/documents', async (req, res) => {
  try {
    const documents = await Document.find().sort({ uploadDate: -1 });
    res.json({ documents });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

app.delete('/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const document = await Document.findById(id);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    try {
      await fs.unlink(document.filepath);
    } catch (err) {
      console.error('Error deleting file:', err);
    }

    await Document.findByIdAndDelete(id);
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

app.post('/chat/session', async (req, res) => {
  try {
    const { documentId } = req.body;
    
    if (!documentId) {
      return res.status(400).json({ error: 'Document ID is required' });
    }

    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.status !== 'completed') {
      return res.status(400).json({ error: 'Document is still processing' });
    }

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session = new ChatSession({ 
      sessionId, 
      documentId,
      title: `Chat about ${document.filename}`
    });
    await session.save();

    res.json({ 
      sessionId,
      documentId,
      documentName: document.filename 
    });
  } catch (error) {
    console.error('Session creation error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

app.get('/chat/sessions', async (req, res) => {
  try {
    const sessions = await ChatSession.find()
      .populate('documentId')
      .sort({ lastActivity: -1 })
      .limit(50);

    const formattedSessions = sessions.map(session => ({
      sessionId: session.sessionId,
      title: session.title,
      documentName: session.documentId?.filename || 'Unknown',
      documentId: session.documentId?._id,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity
    }));

    res.json({ sessions: formattedSessions });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

app.get('/chat/session/:sessionId/messages', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const messages = await ChatMessage.find({ sessionId })
      .sort({ timestamp: 1 });

    res.json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

app.delete('/chat/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    await ChatSession.deleteOne({ sessionId });
    await ChatMessage.deleteMany({ sessionId });

    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

app.post('/chat', async (req, res) => {
  try {
    const { query, sessionId } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const session = await ChatSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const document = await Document.findById(session.documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found for this session' });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });

    const embeddings = createEmbeddings();
    const { vectorStore } = await getVectorStore({
      embeddings,
      // Chat is read-only: never recreate (would wipe all stored vectors) and
      // skip the probe-embed round-trip that is only needed at ingest time.
      recreateOnMismatch: false,
      skipValidation: true,
    });

    const allResults = await vectorStore.similaritySearchWithScore(query, 100);
    
    let searchResults = allResults.filter(([doc]) => {
      const docPdfId = doc.metadata.pdfId;
      return docPdfId === document._id.toString();
    });
    
    if (searchResults.length === 0) {
      searchResults = allResults.filter(([doc]) => {
        const docFilename = doc.metadata.filename || doc.metadata.source || '';
        return docFilename === document.filename || 
               docFilename.includes(document.filename) ||
               document.filename.includes(docFilename);
      }).slice(0, 10);
    }
    
    if (searchResults.length === 0) {
      searchResults = allResults.slice(0, 5);
    }
    
    searchResults = searchResults.slice(0, 10);

    if (!searchResults || searchResults.length === 0) {
      return res.status(400).json({
        error: 'No context found for this document. Try re-uploading or re-vectorizing.',
        details: 'The vector database returned no results for this document.'
      });
    }

    const contextChunks = searchResults
      .map((result, idx) => {
        const [doc, score] = result;
        const page = doc.metadata.pageNumber || 1;
        return `${idx + 1}. [source: "${document.filename}", page ${page}]\n"${doc.pageContent}"\n(Relevance: ${(score * 100).toFixed(1)}%)`;
      })
      .join('\n\n');

const SYSTEM_PROMPT = `You are an intelligent and thoughtful assistant that helps users understand and analyze information found in PDF documents.

Your main goals:
1. Use the provided context snippets from the document as your first and most reliable source.
2. When the context includes related or partial information, use reasoning to form a meaningful and accurate answer.
3. If the user's question is interpretive (for example, asking for a meaning, summary, or translation) and the context does not directly contain the answer, you may answer from your general knowledge — but keep it natural, accurate, and relevant to the question.
4. Avoid saying "I could not find an answer" if you can reasonably infer or explain it using general understanding.
5. Do NOT include file names, page numbers, or citation brackets in your response — keep the answer clean and natural.

Tone and format:
- Write in a clear, natural, and human-like tone.
- Be direct, insightful, and easy to understand.
- You can translate, interpret, or simplify ideas when asked.
- Use Markdown formatting only when it improves readability (e.g., **bold key ideas**, *italicize quotes*, use bullet points only when truly needed).

---

### Context extracted from the PDF:
${contextChunks}

---

### User Question:
${query}

---

### Instructions for your response:
- First, try to answer using the provided context.
- If the context is insufficient, rely on general knowledge to provide a meaningful and relevant explanation.
- Be clear and concise — focus on quality, not quantity.
- Avoid including metadata, citations, or references.
- Always produce a useful answer that helps the user understand the topic.

Your answer:`;

    if (!process.env.GEMINI_API_KEY) {
      console.error('❌ GEMINI_API_KEY is not configured');
      return res.status(500).json({
        error: 'API key missing or invalid.',
        details: 'Server configuration error'
      });
    }

    let answerText;
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        const result = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: SYSTEM_PROMPT
        });

        answerText = result.text;
        break;
        
      } catch (apiError) {
        retryCount++;
        console.error(`❌ Gemini API error (attempt ${retryCount}/${maxRetries}):`, apiError.message);
        
        const isRateLimit = apiError.status === 429;
        const isRetryable = apiError.status === 503 || 
                           apiError.message?.includes('overloaded') ||
                           apiError.message?.includes('timeout');
        
        if (isRateLimit) {
          console.error('❌ Rate limit exceeded');
          throw apiError;
        }
        
        if (!isRetryable || retryCount >= maxRetries) {
          console.error('❌ Gemini API final failure');
          throw apiError;
        }
        
        const waitTime = Math.pow(2, retryCount - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    if (!answerText) {
      throw new Error('Failed to get response from Gemini API after retries');
    }

    const sources = searchResults.map((result, idx) => {
      const [doc, score] = result;
      return {
        id: idx,
        text: doc.pageContent.substring(0, 300),
        page: doc.metadata.pageNumber || 1,
        filename: document.filename,
        score: score,
      };
    });

    await ChatSession.findOneAndUpdate(
      { sessionId },
      { 
        lastActivity: new Date(),
        title: query.substring(0, 100)
      }
    );

    await ChatMessage.create({
      sessionId,
      role: 'user',
      message: query,
      sources: null
    });

    await ChatMessage.create({
      sessionId,
      role: 'assistant',
      message: answerText,
      sources: sources
    });

    return res.json({ 
      answer: answerText,
      sources,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Chat error:', error);
    
    let userMessage = 'Chat failed. Please try again.';
    let statusCode = 500;
    
    if (error.status === 429) {
      userMessage = 'Rate limit exceeded - free tier quota exhausted. Please wait 60 seconds and try again, or use a new API key.';
      statusCode = 429;
    } else if (error.status === 503 || error.message?.includes('overloaded')) {
      userMessage = 'The AI service is currently busy. Please try again in a few moments.';
      statusCode = 503;
    } else if (error.message?.includes('API key')) {
      userMessage = 'API configuration error. Please contact support.';
      statusCode = 500;
    }
    
    return res.status(statusCode).json({ 
      error: userMessage, 
      details: error.message,
      type: error.constructor.name,
      retryable: error.status === 503 || error.status === 429
    });
  }
});

app.get('/chat/sessions', async (req, res) => {
  try {
    const sessions = await ChatSession.find()
      .sort({ lastActivity: -1 })
      .limit(50);
    
    const sessionsWithCount = await Promise.all(
      sessions.map(async (session) => {
        const messageCount = await ChatMessage.countDocuments({ sessionId: session.sessionId });
        return {
          _id: session._id,
          sessionId: session.sessionId,
          title: session.title || 'New Chat',
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          messageCount
        };
      })
    );

    res.json({ sessions: sessionsWithCount });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

app.get('/chat/sessions/:sessionId/messages', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const messages = await ChatMessage.find({ sessionId }).sort({ timestamp: 1 });
    res.json({ messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.delete('/chat/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    await ChatMessage.deleteMany({ sessionId });
    await ChatSession.findOneAndDelete({ sessionId });
    
    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

app.patch('/chat/sessions/:sessionId/title', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title } = req.body;
    
    await ChatSession.findOneAndUpdate(
      { sessionId },
      { title }
    );
    
    res.json({ message: 'Title updated successfully' });
  } catch (error) {
    console.error('Error updating title:', error);
    res.status(500).json({ error: 'Failed to update title' });
  }
});

app.patch('/documents/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, pageCount } = req.body;

    await Document.findByIdAndUpdate(id, {
      status,
      pageCount: pageCount || null
    });

    res.json({ message: 'Document status updated' });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

connectDB().then(() => {
  app.listen(8000, () => {
    console.log('🚀 RAG Server running on http://localhost:8000');
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
