// DELTARUNE's Dark Fountain, played over the page when the dark world opens.
// The video is "stacked alpha": colour on top, transparency below as greyscale, one plain H.264 file that every
// browser (Safari too) can play. WebGL puts the halves back together into a see-through picture.

const SRC = '/decor/dark-fountain.mp4';
const STILL = '/decor/dark-fountain-still.webp';

const vertex = `attribute vec2 p; varying vec2 uv;
void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

// top half = colour, bottom half = alpha; the smoothstep hides faint compression noise in the alpha
const fragment = `precision mediump float; uniform sampler2D t; varying vec2 uv;
void main() {
	float y = min((1.0 - uv.y) * 0.5, 0.4985);
	vec3 rgb = texture2D(t, vec2(uv.x, y)).rgb;
	float a = smoothstep(0.05, 0.95, texture2D(t, vec2(uv.x, y + 0.5)).r);
	gl_FragColor = vec4(rgb * a, a);
}`;

function compositor(canvas: HTMLCanvasElement, video: HTMLVideoElement) {
	const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
	if (!gl) return null;
	const shader = (type: number, src: string) => {
		const s = gl.createShader(type)!;
		gl.shaderSource(s, src);
		gl.compileShader(s);
		return s;
	};
	const program = gl.createProgram()!;
	gl.attachShader(program, shader(gl.VERTEX_SHADER, vertex));
	gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment));
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
	gl.useProgram(program);

	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
	const p = gl.getAttribLocation(program, 'p');
	gl.enableVertexAttribArray(p);
	gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);

	gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
	for (const [k, v] of [
		[gl.TEXTURE_MIN_FILTER, gl.LINEAR],
		[gl.TEXTURE_MAG_FILTER, gl.LINEAR],
		[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],
		[gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
	]) gl.texParameteri(gl.TEXTURE_2D, k, v);

	return () => {
		if (video.readyState < 2) return;
		const w = video.videoWidth;
		const h = video.videoHeight / 2;
		if (canvas.width !== w || canvas.height !== h) {
			canvas.width = w;
			canvas.height = h;
			gl.viewport(0, 0, w, h);
		}
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	};
}

/** Plays the fountain; `onDark` runs once the screen has gone black (or when it's closed early). */
export function fountain({ calm, onDark }: { calm: boolean; onDark: () => void }) {
	const el = document.createElement('div');
	el.className = 'fountain';
	el.innerHTML = '<p class="fountain-credit">dark fountain from DELTARUNE by Toby Fox</p>';

	const video = document.createElement('video');
	video.src = SRC;
	video.playsInline = true;
	video.preload = 'auto';

	const canvas = document.createElement('canvas');
	canvas.setAttribute('aria-hidden', 'true');
	const draw = calm ? null : compositor(canvas, video);
	if (draw) el.prepend(canvas);
	else {
		// reduced motion, or no WebGL: a still frame while the sound plays
		const img = new Image();
		img.src = STILL;
		img.alt = '';
		img.className = 'fountain-still';
		el.prepend(img);
	}
	document.body.append(el);

	let frame = 0;
	const loop = () => {
		draw?.();
		frame = 'requestVideoFrameCallback' in video ? video.requestVideoFrameCallback(loop) : requestAnimationFrame(loop);
	};

	let closed = false;
	const close = () => {
		if (closed) return;
		closed = true;
		onDark();
		video.pause();
		if ('cancelVideoFrameCallback' in video) video.cancelVideoFrameCallback(frame);
		else cancelAnimationFrame(frame);
		removeEventListener('keydown', onKey);
		el.classList.add('out');
		setTimeout(() => el.remove(), calm ? 0 : 600);
	};
	const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
	addEventListener('keydown', onKey);
	el.addEventListener('click', close);
	video.addEventListener('ended', close);
	video.addEventListener('error', close);

	// This runs inside the Konami keypress (or tap), so sound is allowed. If the browser says no anyway,
	// it plays muted with a small button to turn the sound on (or to start it, if even that was blocked).
	video.play().then(loop, () => {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'fountain-sound';
		button.textContent = 'sound on';
		button.addEventListener('click', (e) => {
			e.stopPropagation();
			video.muted = false;
			button.remove();
			if (video.paused) video.play().then(loop, close);
		});
		el.append(button);
		button.focus({ preventScroll: true });
		video.muted = true;
		video.play().then(loop, () => (button.textContent = 'play'));
	});
}
