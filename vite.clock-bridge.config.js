import { defineConfig } from 'vite';

export default defineConfig({
	build: {
		outDir: 'dist',
		emptyOutDir: false, // Prevents clearing the dist folder, preserving taskBot.iife.js built in the first step during sequential build
		lib: {
			entry: 'src/clock-bridge.ts',
			name: 'clockBridge',
			formats: ['iife'],
			fileName: 'clock-bridge',
		},
	},
	publicDir: false,
});
