#!/bin/sh
# Rebuilds public/decor/dark-fountain.mp4 (+ still) from the green-screen original.
# Usage: scripts/fountain.sh path/to/dark.mp4   (needs ffmpeg with libx264; the keying step takes a few minutes)
#
# Output is "stacked alpha": the picture on top, its transparency underneath as greyscale, in one H.264 file that
# plays everywhere (Safari has no VP9 alpha). src/scripts/fountain.ts recombines the halves with WebGL.
set -eu
src=${1:?give the green-screen video}
out=public/decor
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# Unmix the green: alpha = how far a pixel is from pure green; the colour is divided back out so edges keep no
# green fringe. The art is greyscale, so the colour is rebuilt from red and blue only. Black side bars are cropped.
K=180
A="clip(1-(g(X,Y)-(r(X,Y)+b(X,Y))/2)/$K,0,1)"
AT="clip(($A-0.06)/0.88,0,1)"
GRAY="if(gt($A,0.02),clip((r(X,Y)+b(X,Y))/2/$A,0,255),0)"
KEY="crop=1140:720:70:0,scale=960:606:flags=lanczos,format=gbrap,geq=r='$GRAY':g='$GRAY':b='$GRAY':a='255*$AT'"

ffmpeg -loglevel error -y -i "$src" \
	-filter_complex "[0:v]$KEY,format=yuva444p,split[c][a];[a]alphaextract[a];[c]format=yuv444p[c];[c][a]vstack,format=yuv444p[v]" \
	-map "[v]" -map 0:a -c:v ffv1 -c:a flac "$tmp/stacked.mkv"

# Clean near-black/near-white noise and drop all colour, then encode small.
CLEAN="lutyuv=y='if(lt(val,24),16,if(gt(val,228),235,val))':u=128:v=128"
ffmpeg -loglevel error -y -i "$tmp/stacked.mkv" -vf "scale=800:-2:flags=lanczos,$CLEAN" \
	-c:v libx264 -pix_fmt yuv420p -profile:v high -crf 32 -preset slow -tune animation -g 300 \
	-c:a aac -b:a 56k -movflags +faststart "$out/dark-fountain.mp4"

# Still frame with real transparency, shown under reduced motion.
ffmpeg -loglevel error -y -ss 3 -i "$tmp/stacked.mkv" \
	-filter_complex "[0:v]scale=800:-2:flags=lanczos,split[a][b];[a]crop=800:505:0:0,format=rgb24[c];[b]crop=800:505:0:505,format=gray[m];[c][m]alphamerge,format=rgba" \
	-frames:v 1 -c:v libwebp -quality 85 "$out/dark-fountain-still.webp"

ls -l "$out/dark-fountain.mp4" "$out/dark-fountain-still.webp"
