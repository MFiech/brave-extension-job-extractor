# Security Policy

## Supported Versions

This project is actively maintained. Please use the latest version for security updates.

## Security Best Practices

### Environment Variables
- **Never commit `.env` files** to version control
- Use `env.example` as a template for required environment variables
- Store sensitive credentials only in local `.env` files

### API Keys
- **OpenAI API Key**: Store only in browser extension storage or `.env` file
- **Webhook URLs**: Keep webhook IDs private and use HTTPS when possible
- **Rotate keys regularly** and revoke unused API keys

### Browser Extension Security
- Extension only accesses content when manually activated
- API keys are stored locally in browser sync storage
- No data is transmitted to external services except OpenAI for analysis

### File Security
- `.gitignore` is configured to exclude sensitive files
- Environment variables are never hardcoded in source code
- Example files contain placeholder values only

## Reporting a Vulnerability

If you discover a security vulnerability in this project:

1. **Do NOT** open a public issue
2. Email the maintainer directly with details
3. Include steps to reproduce the vulnerability
4. Allow reasonable time for response before public disclosure

## Security Checklist Before Deployment

- [ ] Verify `.env` file is not committed to git
- [ ] Check that no API keys are hardcoded in source files
- [ ] Confirm `.gitignore` includes all sensitive file patterns
- [ ] Validate that environment variables are properly loaded
- [ ] Test with minimal permissions/scope for API keys
- [ ] Review webhook URLs for security (HTTPS, authentication)

## Known Security Considerations

- OpenAI API usage may be logged by OpenAI according to their privacy policy
- Browser extension can access page content on all websites (required for functionality)
- Local webhook endpoints should be secured appropriately for production use
