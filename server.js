import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3000;

// Allow requests from your Netlify frontend
app.use(cors());

// Increase the JSON limit to 10mb to handle our base64 image uploads!
app.use(express.json({ limit: '10mb' })); 

app.post('/api/gemini', async (req, res) => {
    try {
        // The server reads the API key securely from its environment variables
        const apiKey = process.env.GEMINI_API_KEY;
        
        if (!apiKey) {
            return res.status(500).json({ error: { message: "Server misconfiguration: API key is missing." } });
        }

        // Forward the exact request body sent by the frontend directly to Google's API
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });

        // Parse Google's response and send it right back to the frontend
        const data = await response.json();
        res.status(response.status).json(data);

    } catch (error) {
        res.status(500).json({ error: { message: error.message } });
    }
});

app.listen(port, () => {
    console.log(`Linguist secure backend running on port ${port}`);
});