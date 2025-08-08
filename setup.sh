#!/bin/bash

# Job Extractor Extension Setup Script
# This script helps set up the environment for the browser extension

echo "🚀 Setting up Job Extractor Extension..."
echo

# Check if env.example exists
if [ ! -f "env.example" ]; then
    echo "❌ Error: env.example file not found!"
    echo "   Make sure you're in the correct directory."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📋 Creating .env file from template..."
    cp env.example .env
    echo "✅ .env file created successfully!"
else
    echo "⚠️  .env file already exists. Skipping creation."
fi

echo
echo "📝 Next steps:"
echo "1. Edit the .env file with your actual credentials:"
echo "   nano .env"
echo
echo "2. Get your OpenAI API key from:"
echo "   https://platform.openai.com/api-keys"
echo
echo "3. Update the OPENAI_API_KEY in your .env file"
echo
echo "4. Load the extension in your browser:"
echo "   - Chrome: chrome://extensions/"
echo "   - Brave: brave://extensions/"
echo "   - Enable Developer Mode"
echo "   - Click 'Load unpacked' and select this folder"
echo
echo "🔒 Security reminder:"
echo "   - Never commit your .env file to version control"
echo "   - The .gitignore file is already configured to exclude it"
echo
echo "✅ Setup complete! Happy job hunting! 🎯"
