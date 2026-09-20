import { useRef, useState } from 'react';
import { Camera, X, Upload } from 'lucide-react';
import api from '../api';
import './ImageUpload.css';

/**
 * ImageUpload — reusable profile image picker + Cloudinary uploader
 *
 * Props:
 *   value       {string}   current image URL (controlled)
 *   onChange    {fn}       called with the new Cloudinary URL after upload
 *   shape       {'circle'|'square'}  default 'circle'
 *   size        {number}   preview diameter/side in px, default 96
 *   label       {string}   optional label above the widget
 */
export default function ImageUpload({ value, onChange, shape = 'circle', size = 96, label }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB');
      return;
    }

    setError('');
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      onChange(res.data.url);
    } catch (err) {
      setError(err.response?.data?.msg || 'Upload failed. Try again.');
    } finally {
      setUploading(false);
      // reset so same file can be re-selected
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const clear = (e) => {
    e.stopPropagation();
    onChange('');
  };

  const isCircle = shape === 'circle';

  return (
    <div className="iu-wrapper">
      {label && <span className="form-label">{label}</span>}

      <div className="iu-row">
        {/* Preview */}
        <div
          className={`iu-preview ${isCircle ? 'iu-circle' : 'iu-square'}`}
          style={{ width: size, height: size }}
        >
          {value ? (
            <>
              <img src={value} alt="preview" className="iu-img" />
              {!uploading && (
                <button type="button" className="iu-clear" onClick={clear} title="Remove image">
                  <X size={12} />
                </button>
              )}
            </>
          ) : (
            <div className="iu-placeholder">
              <Camera size={size * 0.28} strokeWidth={1.5} />
            </div>
          )}

          {uploading && (
            <div className="iu-overlay">
              <span className="spinner" />
            </div>
          )}
        </div>

        {/* Drop zone / button */}
        <div
          className={`iu-dropzone ${uploading ? 'iu-dz-loading' : ''}`}
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <Upload size={18} strokeWidth={1.5} className="iu-dz-icon" />
          <p className="iu-dz-primary">
            {uploading ? 'Uploading…' : 'Click or drag & drop'}
          </p>
          <p className="iu-dz-hint">JPG, PNG, WebP · Max 5 MB</p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {error && <p className="iu-error">{error}</p>}
    </div>
  );
}
