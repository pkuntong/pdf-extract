# PDF Invoice Extractor

A modern, mobile-first Progressive Web App (PWA) for extracting structured data from PDF invoices. Built with Next.js 15, TypeScript, and native-like mobile features.

## ✨ Features

### 📱 Mobile-First Experience
- **Native-like UI** - Optimized for mobile devices with touch gestures
- **PWA Support** - Installable on mobile home screens
- **Offline Functionality** - Works without internet connection
- **Pull-to-refresh** - Native mobile gesture support
- **Haptic Feedback** - Touch feedback for better UX

### 🔧 Core Functionality
- **PDF Text Extraction** - Powered by PDF.js
- **Invoice Data Recognition** - Extracts invoice numbers, dates, vendors, and totals
- **Batch Processing** - Upload multiple PDFs simultaneously
- **CSV Export** - Download extracted data in CSV format
- **Error Handling** - Robust error handling with user-friendly messages

### 🎨 User Interface
- **Responsive Design** - Works on all screen sizes
- **Dark Theme** - Modern dark UI optimized for mobile
- **Smooth Animations** - React Spring powered animations
- **Touch Optimized** - Large touch targets and mobile-friendly interactions
- **File Upload** - Drag & drop with camera integration for document scanning

### 🚀 Technical Features
- **TypeScript** - Full type safety
- **Server-Side Rendering** - Next.js 15 with App Router
- **IndexedDB Storage** - Client-side data persistence
- **Service Worker** - Background sync and caching
- **React Hooks** - Modern React patterns

## 🛠️ Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **PDF Processing**: PDF.js
- **Animations**: React Spring
- **Storage**: IndexedDB (via idb)
- **File Upload**: React Dropzone
- **Mobile**: PWA with Service Worker
- **Icons**: Lucide React

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm, yarn, pnpm, or bun

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd pdf-extract
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Run the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

4. **Open in browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### 📱 Mobile Testing

To test mobile features:

1. **Local Network Access**
   - The dev server runs on your network IP (shown in terminal)
   - Access from mobile device using the network URL

2. **PWA Installation**
   - Open in mobile browser
   - Tap "Add to Home Screen" when prompted
   - Launch from home screen for native-like experience

3. **Offline Testing**
   - Install the PWA
   - Turn off network connection
   - App continues to work with cached data

## 📁 Project Structure

```
pdf-extract/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/extract/        # PDF processing API
│   │   ├── globals.css         # Global styles
│   │   ├── layout.tsx          # Root layout with PWA metadata
│   │   └── page.tsx            # Main application page
│   ├── components/             # React components
│   │   ├── LazyComponent.tsx   # Lazy loading wrapper
│   │   ├── MobileFileUpload.tsx # Mobile-optimized file upload
│   │   └── PullToRefresh.tsx   # Pull-to-refresh gesture
│   ├── hooks/                  # Custom React hooks
│   │   ├── useHapticFeedback.ts # Haptic feedback utilities
│   │   └── useOfflineStorage.ts # IndexedDB storage
│   └── types/                  # TypeScript type definitions
│       └── extraction.ts       # Data extraction types
├── public/                     # Static assets
│   ├── manifest.json          # PWA manifest
│   ├── icon.svg               # Scalable app icon
│   ├── icon-*.png             # PWA icons (various sizes)
│   └── favicon.ico            # Browser favicon
├── next.config.ts             # Next.js configuration
├── tailwind.config.ts         # Tailwind CSS configuration
└── tsconfig.json              # TypeScript configuration
```

## 🔧 Configuration

### Environment Variables
No environment variables required for basic functionality.

### PWA Configuration
PWA settings are configured in:
- `public/manifest.json` - App manifest
- `src/app/layout.tsx` - PWA metadata
- `next.config.ts` - Build configuration

## 📋 Usage

### Basic Usage
1. **Upload PDFs** - Drag & drop or click to select PDF files
2. **Processing** - App automatically extracts invoice data
3. **Review Results** - View extracted data in the results table
4. **Export Data** - Download results as CSV file

### Mobile Usage
1. **Install PWA** - Add to home screen for native experience
2. **Scan Documents** - Use camera button to scan physical invoices
3. **Offline Mode** - Continue working without internet
4. **Pull to Refresh** - Refresh data with pull gesture

### Advanced Features
- **Batch Processing** - Upload up to 10 PDFs simultaneously
- **Error Recovery** - Failed extractions are clearly marked
- **Data Persistence** - Results are saved locally
- **Background Sync** - Data syncs when connection returns

## 🎯 Supported Invoice Formats

The app can extract data from various invoice formats:

- **Invoice Numbers**: INV-123, #12345, Invoice: ABC-456
- **Dates**: MM/DD/YYYY, YYYY-MM-DD, Month DD, YYYY
- **Vendors**: Company names and business entities
- **Amounts**: $XXX.XX, XXX.XX, various currency formats

## 🔍 API Reference

### PDF Extraction Endpoint

```typescript
POST /api/extract
Content-Type: multipart/form-data

Body: FormData with 'files' field containing PDF files

Response: {
  extractions: Array<{
    filename?: string;
    invoiceNumber?: string;
    date?: string;
    vendor?: string;
    total?: string;
    error?: string;
  }>
}
```

## 🚀 Deployment

### Build for Production
```bash
npm run build
npm start
```

### Deploy to Vercel
```bash
npx vercel
```

### Deploy to Other Platforms
The app can be deployed to any platform supporting Node.js:
- Netlify
- Heroku
- Railway
- DigitalOcean App Platform

## 🐛 Troubleshooting

### Common Issues

**PDF Processing Fails**
- Ensure PDFs are not password protected
- Check PDF contains selectable text (not scanned images)
- Verify file size is reasonable (<10MB)

**PWA Installation Issues**
- Use HTTPS in production
- Ensure all manifest icons exist
- Check service worker registration

**Mobile Performance**
- Clear browser cache
- Ensure adequate device memory
- Update to latest browser version

### Development Issues

**Build Errors**
```bash
# Clear Next.js cache
rm -rf .next
npm run build
```

**TypeScript Errors**
```bash
# Check types
npx tsc --noEmit
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - React framework
- [PDF.js](https://mozilla.github.io/pdf.js/) - PDF processing
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [React Spring](https://react-spring.dev/) - Animations
- [Lucide](https://lucide.dev/) - Icons

## 📱 Browser Support

- **Mobile**: iOS Safari 14+, Chrome 90+, Firefox 90+
- **Desktop**: Chrome 90+, Firefox 90+, Safari 14+, Edge 90+
- **PWA**: All modern browsers with service worker support

---

**Built with ❤️ for mobile-first PDF processing**