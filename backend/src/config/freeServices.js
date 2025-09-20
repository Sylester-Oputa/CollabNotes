/**
 * Free Services Configuration
 * Complete communication suite using only free/open-source alternatives
 */

const FREE_SERVICES_CONFIG = {
  // Email Service - Gmail SMTP (500 emails/day free)
  email: {
    provider: 'gmail',
    config: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.GMAIL_USER, // your-app@gmail.com
        pass: process.env.GMAIL_APP_PASSWORD // App-specific password
      }
    },
    limits: {
      dailyLimit: 500,
      monthlyLimit: 15000,
      rateLimitPerHour: 100
    },
    features: ['templates', 'tracking', 'scheduling']
  },

  // Video Calling - Jitsi Meet (completely free)
  video: {
    provider: 'jitsi',
    config: {
      domain: 'meet.jit.si', // or your self-hosted domain
      options: {
        roomName: 'CollabNotes-{roomId}',
        width: '100%',
        height: '600px',
        parentNode: null,
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          enableWelcomePage: false,
          prejoinPageEnabled: false,
          disableModeratorIndicator: false,
          enableEmailInStats: false
        },
        interfaceConfigOverwrite: {
          TOOLBAR_BUTTONS: [
            'microphone', 'camera', 'closedcaptions', 'desktop',
            'fullscreen', 'fodeviceselection', 'hangup', 'profile',
            'chat', 'recording', 'livestreaming', 'etherpad',
            'sharedvideo', 'settings', 'raisehand', 'videoquality',
            'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
            'tileview', 'videobackgroundblur', 'download', 'help',
            'mute-everyone', 'security'
          ]
        }
      }
    },
    features: ['screen-sharing', 'recording', 'chat', 'whiteboard'],
    limits: {
      participants: 75, // Jitsi recommended limit
      duration: 'unlimited',
      concurrent_rooms: 'unlimited'
    }
  },

  // Speech-to-Text - OpenAI Whisper (completely free, local)
  speech: {
    provider: 'whisper',
    config: {
      model: 'base', // Options: tiny, base, small, medium, large
      language: 'auto', // Auto-detect or specify
      local: true, // Run locally (no API costs)
      outputFormat: 'json'
    },
    installation: {
      command: 'pip install openai-whisper',
      requirements: ['ffmpeg', 'python3']
    },
    features: ['transcription', 'translation', 'language-detection'],
    limits: {
      fileSize: '25MB',
      duration: '30 minutes per file',
      concurrent: 'depends on server resources'
    }
  },

  // Real-time Chat - Socket.IO (open-source)
  chat: {
    provider: 'socketio',
    config: {
      cors: {
        origin: process.env.FRONTEND_URLS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    },
    features: ['real-time', 'rooms', 'typing-indicators', 'file-sharing'],
    limits: 'only server resources'
  },

  // Database - Supabase (500MB free)
  database: {
    provider: 'supabase',
    config: {
      url: process.env.SUPABASE_URL,
      key: process.env.SUPABASE_ANON_KEY,
      realtime: true
    },
    features: ['postgresql', 'real-time', 'auth', 'storage'],
    limits: {
      storage: '500MB',
      bandwidth: '2GB',
      realtimeConnections: 200,
      authUsers: 50000
    }
  },

  // File Storage - Cloudflare R2 (10GB free)
  storage: {
    provider: 'cloudflare-r2',
    config: {
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
      secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
      bucket: process.env.CLOUDFLARE_BUCKET_NAME,
      region: 'auto'
    },
    features: ['s3-compatible', 'cdn', 'global-distribution'],
    limits: {
      storage: '10GB',
      requests: '1M per month',
      bandwidth: 'unlimited egress'
    }
  },

  // Screen Sharing - WebRTC + coturn (free TURN server)
  screenSharing: {
    provider: 'webrtc',
    turnServer: {
      provider: 'coturn', // Self-hosted TURN server
      config: {
        urls: [
          'stun:your-server.com:3478',
          'turn:your-server.com:3478'
        ],
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_PASSWORD
      },
      installation: {
        ubuntu: 'sudo apt-get install coturn',
        docker: 'docker run -d --network=host coturn/coturn'
      }
    },
    features: ['screen-capture', 'annotations', 'recording'],
    limits: 'server bandwidth and resources'
  },

  // Hosting - Vercel (free tier)
  hosting: {
    frontend: {
      provider: 'vercel',
      features: ['static-hosting', 'serverless-functions', 'cdn'],
      limits: {
        bandwidth: '100GB',
        builds: '6000 minutes',
        serverlessInvocations: '1M'
      }
    },
    backend: {
      provider: 'railway',
      features: ['container-hosting', 'auto-scaling', 'databases'],
      limits: {
        executionTime: '500 hours',
        memory: '512MB',
        storage: '1GB'
      }
    }
  }
};

/**
 * Free Alternative Implementation Examples
 */

// 1. Email with Gmail SMTP
class FreeEmailService {
  constructor() {
    this.transporter = nodemailer.createTransporter({
      ...FREE_SERVICES_CONFIG.email.config
    });
  }

  async sendEmail(emailData) {
    // Same implementation as paid service
    return await this.transporter.sendMail(emailData);
  }
}

// 2. Video with Jitsi Meet
class FreeVideoService {
  initializeJitsi(roomId, containerId) {
    const config = FREE_SERVICES_CONFIG.video.config;
    const options = {
      ...config.options,
      roomName: config.options.roomName.replace('{roomId}', roomId),
      parentNode: document.getElementById(containerId)
    };
    
    const api = new JitsiMeetExternalAPI(config.domain, options);
    return api;
  }
}

// 3. Speech-to-Text with Whisper
class FreeSpeechService {
  async transcribeAudio(audioFilePath) {
    const { spawn } = require('child_process');
    
    return new Promise((resolve, reject) => {
      const whisper = spawn('whisper', [
        audioFilePath,
        '--model', 'base',
        '--output_format', 'json',
        '--language', 'auto'
      ]);
      
      let output = '';
      whisper.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      whisper.on('close', (code) => {
        if (code === 0) {
          resolve(JSON.parse(output));
        } else {
          reject(new Error(`Whisper failed with code ${code}`));
        }
      });
    });
  }
}

// 4. Storage with Cloudflare R2
class FreeStorageService {
  constructor() {
    this.r2 = new AWS.S3({
      endpoint: `https://${FREE_SERVICES_CONFIG.storage.config.accountId}.r2.cloudflarestorage.com`,
      accessKeyId: FREE_SERVICES_CONFIG.storage.config.accessKeyId,
      secretAccessKey: FREE_SERVICES_CONFIG.storage.config.secretAccessKey,
      region: 'auto'
    });
  }

  async uploadFile(file, key) {
    return await this.r2.upload({
      Bucket: FREE_SERVICES_CONFIG.storage.config.bucket,
      Key: key,
      Body: file,
      ContentType: file.mimetype
    }).promise();
  }
}

/**
 * Setup Instructions for Free Services
 */
const SETUP_INSTRUCTIONS = {
  gmail: {
    steps: [
      '1. Create Gmail account for your app',
      '2. Enable 2-factor authentication',
      '3. Generate App Password in Security settings',
      '4. Use App Password (not regular password) in config'
    ],
    limits: 'Stay under 500 emails/day to avoid blocks'
  },

  whisper: {
    installation: [
      '1. Install Python 3.7+',
      '2. Install ffmpeg: apt-get install ffmpeg',
      '3. Install Whisper: pip install openai-whisper',
      '4. Download model: whisper --model base dummy.mp3'
    ],
    performance: 'Base model works well for most languages'
  },

  coturn: {
    installation: [
      '1. Install: sudo apt-get install coturn',
      '2. Configure: /etc/turnserver.conf',
      '3. Open ports: 3478 (STUN/TURN), 5349 (TURNS)',
      '4. Start service: sudo systemctl start coturn'
    ],
    cost: 'Only server hosting costs (~$5-10/month)'
  },

  supabase: {
    setup: [
      '1. Create account at supabase.com',
      '2. Create new project',
      '3. Get URL and anon key from settings',
      '4. Use PostgreSQL connection for Prisma'
    ],
    upgrade: 'Can upgrade to paid when needed'
  }
};

module.exports = {
  FREE_SERVICES_CONFIG,
  FreeEmailService,
  FreeVideoService,
  FreeSpeechService,
  FreeStorageService,
  SETUP_INSTRUCTIONS
};