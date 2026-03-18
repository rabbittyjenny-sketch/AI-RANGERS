// elevenlabsService.ts

import axios from 'axios';

const API_BASE_URL = 'https://api.elevenlabs.io';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

export class ElevenLabsService {
    constructor() {
        if (!ELEVENLABS_API_KEY) {
            throw new Error('API key is missing');
        }
    }

    // Text-to-Speech (TTS) method
    async textToSpeech(text, voice = 'default', options = {}) {
        const url = `${API_BASE_URL}/text-to-speech/${voice}`;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ELEVENLABS_API_KEY}`,
        };
        const requestBody = {
            text,
            ...options
        };

        try {
            const response = await axios.post(url, requestBody, { headers });
            return response.data;
        } catch (error) {
            console.error('Error in textToSpeech:', error);
            throw error;
        }
    }

    // Speech-to-Text (STT) method
    async speechToText(audioFile) {
        const url = `${API_BASE_URL}/speech-to-text`;
        const headers = {
            'Authorization': `Bearer ${ELEVENLABS_API_KEY}`,
        };
        const formData = new FormData();
        formData.append('file', audioFile);

        try {
            const response = await axios.post(url, formData, { headers });
            return response.data;
        } catch (error) {
            console.error('Error in speechToText:', error);
            throw error;
        }
    }
}

export default new ElevenLabsService();