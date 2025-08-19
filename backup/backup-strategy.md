# 💾 Backup & Disaster Recovery Strategy

## Database Backups (Supabase)

### 1. Automated Daily Backups
Supabase Pro automatically includes:
- Daily automated backups (7-day retention)
- Point-in-time recovery (PITR)
- Cross-region replication

### 2. Manual Backup Script
Create `scripts/backup-database.js`:

```javascript
#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function backupTable(tableName) {
  console.log(`📋 Backing up ${tableName}...`)
  
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
    
    if (error) throw error
    
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `${tableName}_backup_${timestamp}.json`
    const filepath = path.join(__dirname, '..', 'backups', filename)
    
    // Ensure backups directory exists
    const backupsDir = path.dirname(filepath)
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true })
    }
    
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
    console.log(`✅ ${tableName} backed up to ${filename}`)
    
    return { table: tableName, records: data?.length || 0, file: filename }
  } catch (error) {
    console.error(`❌ Error backing up ${tableName}:`, error.message)
    return { table: tableName, error: error.message }
  }
}

async function performBackup() {
  console.log('🚀 Starting database backup...')
  console.log(`📅 ${new Date().toISOString()}`)
  
  const tables = ['subscriptions', 'feedback']
  const results = []
  
  for (const table of tables) {
    const result = await backupTable(table)
    results.push(result)
  }
  
  // Create backup summary
  const summary = {
    timestamp: new Date().toISOString(),
    results,
    totalTables: tables.length,
    successfulBackups: results.filter(r => !r.error).length,
    totalRecords: results.reduce((sum, r) => sum + (r.records || 0), 0)
  }
  
  const summaryFile = path.join(__dirname, '..', 'backups', `backup_summary_${new Date().toISOString().split('T')[0]}.json`)
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2))
  
  console.log('\n📊 Backup Summary:')
  console.log(`✅ Successfully backed up: ${summary.successfulBackups}/${summary.totalTables} tables`)
  console.log(`📁 Total records: ${summary.totalRecords}`)
  
  if (summary.successfulBackups < summary.totalTables) {
    console.log('⚠️  Some backups failed. Check the logs above.')
    process.exit(1)
  } else {
    console.log('🎉 All backups completed successfully!')
  }
}

// Run backup if called directly
if (require.main === module) {
  performBackup().catch(error => {
    console.error('💥 Backup failed:', error)
    process.exit(1)
  })
}

module.exports = { performBackup, backupTable }
```

### 3. Automated Cloud Backup
Create GitHub Action `.github/workflows/backup.yml`:

```yaml
name: Database Backup

on:
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM UTC
  workflow_dispatch: # Manual trigger

jobs:
  backup:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout repository
      uses: actions/checkout@v4
      
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run backup
      env:
        NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
        SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      run: node scripts/backup-database.js
      
    - name: Upload backup artifacts
      uses: actions/upload-artifact@v3
      with:
        name: database-backups
        path: backups/
        retention-days: 30
        
    - name: Notify on failure
      if: failure()
      uses: 8398a7/action-slack@v3
      with:
        status: failure
        webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
        text: "🚨 Database backup failed!"
```

## Code & Configuration Backups

### 1. Multiple Git Remotes
```bash
# Add multiple git remotes for redundancy
git remote add github https://github.com/username/pdf-extract.git
git remote add gitlab https://gitlab.com/username/pdf-extract.git
git remote add bitbucket https://bitbucket.org/username/pdf-extract.git

# Push to all remotes
git push --all github
git push --all gitlab  
git push --all bitbucket
```

### 2. Environment Variables Backup
Create `scripts/backup-env.js`:

```javascript
#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

// NEVER commit this file - for local backup only
const ENCRYPTION_KEY = process.env.BACKUP_ENCRYPTION_KEY || 'your-32-char-key-here'

function encryptText(text) {
  const cipher = crypto.createCipher('aes192', ENCRYPTION_KEY)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return encrypted
}

function decryptText(encryptedText) {
  const decipher = crypto.createDecipher('aes192', ENCRYPTION_KEY)
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

const envVarsToBackup = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PRO_PRICE_ID',
  'SLACK_WEBHOOK_URL'
]

function backupEnvironment() {
  const backup = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    variables: {}
  }
  
  envVarsToBackup.forEach(varName => {
    const value = process.env[varName]
    if (value) {
      backup.variables[varName] = encryptText(value)
    }
  })
  
  const filename = `env_backup_${new Date().toISOString().split('T')[0]}.json`
  const filepath = path.join(__dirname, '..', 'backups', 'env', filename)
  
  // Ensure directory exists
  const backupsDir = path.dirname(filepath)
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true })
  }
  
  fs.writeFileSync(filepath, JSON.stringify(backup, null, 2))
  console.log(`🔐 Environment variables backed up to ${filename}`)
  console.log(`🔑 Use BACKUP_ENCRYPTION_KEY to decrypt`)
}

if (require.main === module) {
  backupEnvironment()
}
```

### 3. Configuration Files Backup
Key files to regularly backup:
- `package.json` & `package-lock.json`
- `next.config.js`
- `vercel.json`
- `tsconfig.json`
- `.env.example`
- All migration files
- Documentation files

## File Storage Backup

### 1. User Uploaded Files
Since you're not storing user files permanently, this is less critical, but for any temporary files:

```typescript
// Clean up temporary files after processing
export async function cleanupTempFiles(maxAge: number = 3600000) { // 1 hour
  const tempDir = path.join(process.cwd(), 'temp')
  
  if (!fs.existsSync(tempDir)) return
  
  const files = fs.readdirSync(tempDir)
  const now = Date.now()
  
  for (const file of files) {
    const filePath = path.join(tempDir, file)
    const stats = fs.statSync(filePath)
    
    if (now - stats.mtime.getTime() > maxAge) {
      fs.unlinkSync(filePath)
      console.log(`🧹 Cleaned up temp file: ${file}`)
    }
  }
}
```

### 2. Static Assets Backup
For public assets (logos, images, etc.):

```bash
#!/bin/bash
# Backup static assets to S3 or similar

aws s3 sync public/ s3://your-backup-bucket/static-assets/ \
  --exclude ".DS_Store" \
  --exclude "*.tmp"
```

## Disaster Recovery Plan

### 1. Recovery Procedures

#### Database Recovery
```bash
# 1. Point-in-time recovery (Supabase Pro)
# Use Supabase dashboard to restore to specific timestamp

# 2. Manual restore from backup
node scripts/restore-database.js backup_file.json

# 3. Verify data integrity
node scripts/verify-database.js
```

#### Application Recovery
```bash
# 1. Clone from backup repository
git clone https://github.com/username/pdf-extract-backup.git

# 2. Restore environment variables
# (decrypt and manually set in Vercel dashboard)

# 3. Redeploy
vercel --prod

# 4. Update DNS if needed
# 5. Test all critical paths
# 6. Notify users via status page
```

### 2. Recovery Time Objectives (RTO)
- **Database**: < 1 hour
- **Application**: < 30 minutes  
- **DNS/CDN**: < 15 minutes
- **Full service**: < 2 hours

### 3. Recovery Point Objectives (RPO)
- **Database**: < 24 hours (daily backups)
- **Code**: Real-time (git)
- **Configuration**: < 24 hours

## Backup Monitoring & Testing

### 1. Backup Verification Script
Create `scripts/verify-backups.js`:

```javascript
#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

function verifyBackups() {
  const backupsDir = path.join(__dirname, '..', 'backups')
  const today = new Date().toISOString().split('T')[0]
  
  const requiredBackups = [
    `subscriptions_backup_${today}.json`,
    `feedback_backup_${today}.json`,
    `backup_summary_${today}.json`
  ]
  
  const results = {
    timestamp: new Date().toISOString(),
    checks: [],
    allPassed: true
  }
  
  for (const backup of requiredBackups) {
    const filepath = path.join(backupsDir, backup)
    const exists = fs.existsSync(filepath)
    
    let fileSize = 0
    let isValid = false
    
    if (exists) {
      const stats = fs.statSync(filepath)
      fileSize = stats.size
      
      try {
        const content = JSON.parse(fs.readFileSync(filepath, 'utf8'))
        isValid = Array.isArray(content) || typeof content === 'object'
      } catch (e) {
        isValid = false
      }
    }
    
    const passed = exists && fileSize > 0 && isValid
    
    results.checks.push({
      file: backup,
      exists,
      fileSize,
      isValid,
      passed
    })
    
    if (!passed) results.allPassed = false
    
    console.log(`${passed ? '✅' : '❌'} ${backup}: ${exists ? `${fileSize} bytes` : 'missing'}`)
  }
  
  // Save verification results
  const resultsFile = path.join(backupsDir, `backup_verification_${today}.json`)
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2))
  
  return results
}

if (require.main === module) {
  const results = verifyBackups()
  
  if (results.allPassed) {
    console.log('\n🎉 All backup verifications passed!')
  } else {
    console.log('\n🚨 Some backup verifications failed!')
    process.exit(1)
  }
}
```

### 2. Backup Restoration Testing
Monthly test script:

```javascript
// Test database restoration on staging environment
async function testRestoration() {
  // 1. Create test backup
  // 2. Restore to staging database  
  // 3. Verify data integrity
  // 4. Test application functionality
  // 5. Generate report
}
```

## Backup Retention Policy

### 1. Retention Schedule
- **Daily backups**: Keep for 30 days
- **Weekly backups**: Keep for 12 weeks  
- **Monthly backups**: Keep for 12 months
- **Yearly backups**: Keep for 7 years

### 2. Cleanup Script
```javascript
// Clean up old backups based on retention policy
function cleanupOldBackups() {
  const backupsDir = path.join(__dirname, '..', 'backups')
  const now = new Date()
  
  const files = fs.readdirSync(backupsDir)
  
  for (const file of files) {
    const filepath = path.join(backupsDir, file)
    const stats = fs.statSync(filepath)
    const age = now.getTime() - stats.mtime.getTime()
    const daysOld = age / (1000 * 60 * 60 * 24)
    
    // Delete files older than 30 days
    if (daysOld > 30) {
      fs.unlinkSync(filepath)
      console.log(`🧹 Deleted old backup: ${file} (${Math.round(daysOld)} days old)`)
    }
  }
}
```

## Emergency Contacts & Procedures

### 1. Emergency Contact List
```
Primary: Your Name - your-email@domain.com - +1-555-0123
Backup: Team Lead - lead@domain.com - +1-555-0124

Service Providers:
- Vercel Support: vercel.com/support
- Supabase Support: supabase.com/support  
- Stripe Support: support.stripe.com
- Domain Registrar: [your registrar support]
```

### 2. Escalation Procedures
1. **Minor Issues** (< 15 min impact): Fix and document
2. **Major Issues** (> 15 min impact): 
   - Update status page
   - Notify via Slack/Discord
   - Begin recovery procedures
3. **Critical Issues** (> 1 hour impact):
   - All of the above
   - Notify customers via email
   - Consider rollback procedures

Add these scripts to your package.json:
```json
{
  "scripts": {
    "backup": "node scripts/backup-database.js",
    "verify-backups": "node scripts/verify-backups.js", 
    "backup-env": "node scripts/backup-env.js",
    "disaster-recovery": "node scripts/disaster-recovery.js"
  }
}
```

This comprehensive backup strategy ensures your SaaS can recover quickly from any disaster while minimizing data loss and downtime.