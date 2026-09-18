import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    emptyOutDir: true,  // 빌드 전 자동으로 www 폴더 비워줌
    sourcemap: true,     // source map 생성 (디버깅용)
  }
})