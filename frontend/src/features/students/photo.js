export async function prepareStudentPhoto(file) {
    if (!file || !file.size) return undefined;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5*1024*1024)
        throw new Error('Chọn ảnh JPEG, PNG hoặc WebP không quá 5 MB.');
    const bitmap = await createImageBitmap(file);
    try {
        const scale = Math.min(1,480/bitmap.width,600/bitmap.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1,Math.round(bitmap.width*scale));
        canvas.height = Math.max(1,Math.round(bitmap.height*scale));
        const ctx=canvas.getContext('2d');
        ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
        for(const quality of [.86,.72,.55,.4]) {
            const result=canvas.toDataURL('image/jpeg',quality);
            if(result.length<=108000)return result;
        }
        throw new Error('Ảnh quá nhiều chi tiết. Vui lòng chọn ảnh nhỏ hơn.');
    } finally {bitmap.close();}
}
export function bindPhotoPreview(dialog) {
    const input=dialog.querySelector('[name="photoFile"]'),preview=dialog.querySelector('[data-photo-preview]');
    input.addEventListener('change',async()=>{
        const error=dialog.querySelector('.form-error');
        try {const data=await prepareStudentPhoto(input.files[0]);if(data){preview.src=data;preview.hidden=false;}error.hidden=true;}
        catch(cause){input.value='';error.textContent=cause.message;error.hidden=false;}
    });
}
