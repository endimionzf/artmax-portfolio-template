# Hostico (cPanel) Deployment Guide

This guide will help you deploy your immersive portfolio to Hostico using the "Setup Node.js App" feature.

## 1. Local Preparation

1. Run the automated bundle script:
   ```bash
   npm run bundle:win
   ```
2. This script will:
   - Run `npm run build`.
   - Collect `.next`, `public`, and `server.js`.
   - Create a `deploy.zip` file in your root folder.

## 2. Upload and Extract

1. Login to your **Hostico cPanel**.
2. Open **File Manager** and navigate to your domain's root folder (e.g., `public_html` or a subdirectory).
3. **CRITICAL**: Delete any existing `node_modules` folder or file in that directory on the server before extracting the new zip.
4. Upload and extract the `deploy.zip` file.

## 3. Configure Node.js App in cPanel

1. Go to **Setup Node.js App** in cPanel.
2. Click **Create Application**.
3. Set the following:
   - **Node.js Version**: 18.x
   - **Application Mode**: Production
   - **Application Root**: `public_html/home`
   - **Application URL**: `artmaxstudio.ro` (leave the input field after the slash empty if you want it on the main site, or put `home` if you want it at artmaxstudio.ro/home)
   - **Application startup file**: `server.js`
4. Click **Create**.
5. Once created, click **Run NPM Install** (if necessary, though standalone usually handles this).
6. Click **Restart**.

## 4. Fix Folder Permissions

If your site is giving a 502/500 error, it is likely because the extracted folders don't have the right permissions:

1. In cPanel **File Manager**, go to your folder.
2. Find the **`public`** folder, right-click, and select **Change Permissions**.
3. Set it to **`755`** (Read & Execute for Everyone).
4. Do the same for **`public/portfolio`** and the subfolders (`video`, `3d`, `ai`).
5. Also, ensure **`server.js`** is set to **`644`**.

## 4. Troubleshooting

### Slow or Stuck "NPM Install"

- **Wait Time**: On shared hosting, this can take 5–10 minutes.
- **package-lock**: The script now includes `package-lock.json` to speed this up.
- **Refresh**: If it takes more than 15 minutes, refresh the page and try clicking "Run NPM Install" again. It often resumes where it left off.

### Checking Error Logs

If you see a 500 or 502 error:

1.  Go to **File Manager** in cPanel.
2.  Navigate to your **Application Root** folder (e.g., `public_html/`).
3.  Look for a file named **`stderr.log`**.
4.  Right-click and select **View**. This will show the exact reason the app crashed (e.g., a missing variable or a bad path).

### Understanding the Bundle

When you extract the ZIP, you will see a flat structure:

- **`.next/`**: This contains your **compiled** application. You won't see your source `app/` or `components/` folders here—they are turned into optimized JavaScript inside `.next/server`.
- **`public/`**: Your images and videos.
- **`server.js`**: The brains of the app.
- **`package.json`**: For cPanel to install dependencies.

This is exactly how a production-ready Next.js app should look!

### Advanced Diagnostics (No Terminal)

If you don't have Terminal access in cPanel, your primary tool is the **File Manager**:

1.  **Check for `stderr.log`**: This is the most common place errors are hidden.
2.  **Check for `passenger.log`**: Sometimes Phusion Passenger (the engine) logs errors here if the app fails to even start.
3.  **Setup Node.js App Log Field**: In the cPanel Node.js Selector, look for a field labeled **"Application log file"**. Sometimes you have to type a filename there (like `error.log`) and save for it to start recording.

> [!TIP]
> If you still see a 502/Bad Gateway after trying the latest `deploy.zip`, it's almost certainly because cPanel is "caching" a failed version of your app. Try clicking **Stop App**, then **Start App** instead of just Restart.

- If you use `?debug=true`, the developer controls will appear.
