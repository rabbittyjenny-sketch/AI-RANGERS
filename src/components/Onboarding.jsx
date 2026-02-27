import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { onboardingSteps } from '../data/intelligence';

const Onboarding = ({ onComplete, onCancel, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [formData, setFormData] = useState({
    brandNameTh: '',
    brandNameEn: '',
    industry: '',
    coreUSP: '',
    primaryColor: '#FF1493',
    moodKeywords: '',
    targetAudience: '',
    toneOfVoice: 'professional'
  });

  const [errors, setErrors] = useState({});

  const step = onboardingSteps[currentStep - 1];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateStep = () => {
    const newErrors = {};

    if (currentStep === 1) {
      if (!formData.brandNameTh.trim()) {
        newErrors.brandNameTh = 'Brand name (Thai) is required';
      }
      if (!formData.brandNameEn.trim()) {
        newErrors.brandNameEn = 'Brand name (English) is required';
      }
      if (!formData.industry.trim()) {
        newErrors.industry = 'Industry is required';
      }
      if (!formData.coreUSP.trim()) {
        newErrors.coreUSP = 'Core USP is required';
      }
    }

    if (currentStep === 2) {
      if (!formData.primaryColor) {
        newErrors.primaryColor = 'Primary color is required';
      }
      if (!formData.moodKeywords.trim()) {
        newErrors.moodKeywords = 'Mood keywords are required (3 words separated by comma)';
      }
    }

    if (currentStep === 3) {
      if (!formData.targetAudience.trim()) {
        newErrors.targetAudience = 'Target audience is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep()) {
      if (currentStep < onboardingSteps.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        // Final step - complete onboarding
        const moodKeywords = formData.moodKeywords
          .split(',')
          .map((k) => k.trim())
          .filter((k) => k.length > 0);

        // Convert coreUSP from string to array (split by comma)
        const coreUSPArray = formData.coreUSP
          .split(',')
          .map((usp) => usp.trim())
          .filter((usp) => usp.length > 0);

        const masterContext = {
          brandId: `brand_${Date.now()}`,
          brandNameTh: formData.brandNameTh,
          brandNameEn: formData.brandNameEn,
          industry: formData.industry,
          coreUSP: coreUSPArray,
          visualStyle: {
            primaryColor: formData.primaryColor,
            moodKeywords
          },
          targetAudience: formData.targetAudience,
          toneOfVoice: formData.toneOfVoice,
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        };

        onComplete(masterContext);
      }
    }
  };

  const handleSkip = () => {
    // Create a default master context for users who skip onboarding
    const defaultMasterContext = {
      brandId: `temp_${Date.now()}`,
      brandNameTh: 'Your Brand',
      brandNameEn: 'Your Brand',
      industry: 'General',
      coreUSP: ['Not specified'],
      visualStyle: {
        primaryColor: '#5E9BEB',
        moodKeywords: ['professional']
      },
      targetAudience: 'General audience',
      toneOfVoice: 'professional',
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      isDefault: true
    };

    onSkip(defaultMasterContext);
    setShowSkipConfirm(false);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      onCancel();
    }
  };

  const progressPercentage = (currentStep / (onboardingSteps.length - 1)) * 100;

  return (
    <div className="onboarding-container">
      <div className="onboarding-wrapper neo-box">
        {/* Progress Bar */}
        <div className="progress-section">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${progressPercentage}%`,
                background: 'linear-gradient(90deg, #FF1493, #FF69B4)',
                height: '4px',
                borderRadius: '2px',
                transition: 'width 0.3s ease'
              }}
            ></div>
          </div>
          <div className="progress-text">
            Step {currentStep} of {onboardingSteps.length - 1}
          </div>
        </div>

        {/* Form Content */}
        <div className="onboarding-content">
          <h1 style={{ marginTop: 0 }}>{step.title}</h1>
          <p style={{ fontSize: '13px', color: '#666', marginBottom: '25px' }}>
            {step.section === 'confirmation'
              ? 'Please review your information before finalizing'
              : `Complete step ${currentStep} of ${onboardingSteps.length - 1}`}
          </p>

          {step.section !== 'confirmation' ? (
            <div className="form-fields">
              {step.fields.map((field) => (
                <div key={field.id} className="form-group">
                  <label htmlFor={field.id}>
                    {field.label}
                    {field.required && <span style={{ color: '#FF1493' }}>*</span>}
                  </label>

                  {field.type === 'color' ? (
                    <div className="color-picker-wrapper">
                      <input
                        type="color"
                        id={field.id}
                        name={field.id}
                        value={formData[field.id]}
                        onChange={handleInputChange}
                        className="color-picker"
                      />
                      <span className="color-value">{formData[field.id]}</span>
                    </div>
                  ) : field.type === 'select' ? (
                    <select
                      id={field.id}
                      name={field.id}
                      value={formData[field.id]}
                      onChange={handleInputChange}
                      className="form-input"
                    >
                      <option value="formal">Formal (ทางการ)</option>
                      <option value="casual">Casual (เป็นกันเอง)</option>
                      <option value="playful">Playful (สนุกสนาน)</option>
                      <option value="professional">Professional (มืออาชีพ)</option>
                      <option value="luxury">Luxury (หรูหรา)</option>
                    </select>
                  ) : field.id === 'moodKeywords' ? (
                    <textarea
                      id={field.id}
                      name={field.id}
                      value={formData[field.id]}
                      onChange={handleInputChange}
                      placeholder="e.g., vibrant, modern, luxury"
                      rows="2"
                      className="form-input"
                    />
                  ) : (
                    <input
                      type="text"
                      id={field.id}
                      name={field.id}
                      value={formData[field.id]}
                      onChange={handleInputChange}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                      className="form-input"
                    />
                  )}

                  {field.hint && !errors[field.id] && (
                    <span className="hint-text">{field.hint}</span>
                  )}
                  {errors[field.id] && <span className="error-text">{errors[field.id]}</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className="confirmation-section">
              <div className="confirmation-item">
                <span className="label">Brand Name:</span>
                <span className="value">
                  {formData.brandNameTh} ({formData.brandNameEn})
                </span>
              </div>
              <div className="confirmation-item">
                <span className="label">Industry:</span>
                <span className="value">{formData.industry}</span>
              </div>
              <div className="confirmation-item">
                <span className="label">Core USP:</span>
                <span className="value">{formData.coreUSP.split(',').map((u) => u.trim()).filter(u => u).join(', ')}</span>
              </div>
              <div className="confirmation-item">
                <span className="label">Primary Color:</span>
                <span className="value">
                  <span
                    style={{
                      display: 'inline-block',
                      width: '20px',
                      height: '20px',
                      backgroundColor: formData.primaryColor,
                      borderRadius: '4px',
                      marginRight: '8px',
                      verticalAlign: 'middle'
                    }}
                  ></span>
                  {formData.primaryColor}
                </span>
              </div>
              <div className="confirmation-item">
                <span className="label">Mood Keywords:</span>
                <span className="value">{formData.moodKeywords}</span>
              </div>
              <div className="confirmation-item">
                <span className="label">Target Audience:</span>
                <span className="value">{formData.targetAudience}</span>
              </div>
              <div className="confirmation-item">
                <span className="label">Tone of Voice:</span>
                <span className="value">{formData.toneOfVoice}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="onboarding-footer">
          <button className="neo-btn btn-secondary" onClick={handleBack}>
            <ChevronLeft size={18} />
            {currentStep > 1 ? 'Back' : 'Cancel'}
          </button>

          {currentStep === 1 && (
            <button
              className="neo-btn"
              onClick={() => setShowSkipConfirm(true)}
              style={{
                fontSize: '12px',
                background: 'white',
                color: '#666',
                border: '2px solid #ddd'
              }}
            >
              Skip Setup
            </button>
          )}

          <button
            className="neo-btn btn-primary"
            onClick={handleNext}
            style={{
              background: 'linear-gradient(135deg, #FF1493 0%, #FF69B4 100%)',
              color: 'white',
              flex: currentStep === 1 ? 1 : 2
            }}
          >
            {currentStep === onboardingSteps.length - 1 ? (
              <>
                <Check size={18} />
                Complete Onboarding
              </>
            ) : (
              <>
                Next
                <ChevronRight size={18} />
              </>
            )}
          </button>
        </div>

        {/* Skip Confirmation Modal */}
        {showSkipConfirm && (
          <div className="modal-overlay" onClick={() => setShowSkipConfirm(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>Continue Without Brand Setup?</h2>
              <div className="modal-warning">
                <p>⚠️ <strong>Your system will:</strong></p>
                <ul>
                  <li>NOT remember your brand details</li>
                  <li>Ask for information in each analysis/task</li>
                  <li>Provide generic responses instead of customized ones</li>
                  <li>Reset when you refresh the page</li>
                </ul>
              </div>
              <div className="modal-checkbox">
                <input type="checkbox" id="confirm-skip" defaultChecked />
                <label htmlFor="confirm-skip">I understand and accept</label>
              </div>
              <div className="modal-actions">
                <button
                  className="neo-btn"
                  onClick={() => setShowSkipConfirm(false)}
                  style={{ flex: 1 }}
                >
                  Back to Setup
                </button>
                <button
                  className="neo-btn"
                  onClick={handleSkip}
                  style={{
                    flex: 1,
                    background: '#FF1493',
                    color: 'white',
                    border: '2px solid #FF1493'
                  }}
                >
                  Continue Without Setup
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Styles */}
      <style>{`
        .onboarding-container {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 2000;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .onboarding-wrapper {
          background: white;
          border-radius: 16px;
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: slideUp 0.4s ease;
        }

        @keyframes slideUp {
          from {
            transform: translateY(30px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .progress-section {
          padding: 20px;
          background: #f9f9f9;
          border-bottom: 1px solid #eee;
        }

        .progress-bar {
          background: #e0e0e0;
          height: 4px;
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .progress-text {
          font-size: 12px;
          color: #666;
          text-align: right;
        }

        .onboarding-content {
          flex: 1;
          overflow-y: auto;
          padding: 25px;
        }

        .onboarding-content h1 {
          font-size: 24px;
          margin: 0 0 10px 0;
        }

        .form-fields {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          font-size: 13px;
          font-weight: 600;
          color: #333;
        }

        .form-input {
          padding: 10px 12px;
          border: 2px solid #ddd;
          border-radius: 8px;
          font-size: 13px;
          font-family: inherit;
          transition: all 0.3s ease;
          outline: none;
        }

        .form-input:focus {
          border-color: #FF1493;
          box-shadow: 0 0 0 3px rgba(255, 20, 147, 0.1);
        }

        .color-picker-wrapper {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .color-picker {
          width: 60px;
          height: 40px;
          border: 2px solid #ddd;
          border-radius: 8px;
          cursor: pointer;
        }

        .color-value {
          font-size: 12px;
          font-family: monospace;
          color: #666;
          font-weight: 500;
        }

        .error-text {
          font-size: 11px;
          color: #e74c3c;
          font-weight: 500;
        }

        .hint-text {
          font-size: 11px;
          color: #999;
          font-style: italic;
        }

        .confirmation-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 15px;
          background: #f9f9f9;
          border-radius: 8px;
        }

        .confirmation-item {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          padding: 10px;
          border-bottom: 1px solid #eee;
        }

        .confirmation-item:last-child {
          border-bottom: none;
        }

        .confirmation-item .label {
          font-weight: 600;
          color: #333;
          flex: 0 0 40%;
        }

        .confirmation-item .value {
          color: #666;
          text-align: right;
          flex: 1;
          word-break: break-word;
        }

        .onboarding-footer {
          display: flex;
          gap: 12px;
          padding: 20px;
          border-top: 1px solid #eee;
          background: #f9f9f9;
        }

        .btn-secondary {
          flex: 1;
          background: white;
          border: 2px solid #ddd;
          color: #333;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .btn-secondary:hover {
          border-color: #333;
          background: #f5f5f5;
        }

        .btn-primary {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-weight: 600;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 3000;
          padding: 20px;
        }

        .modal-content {
          background: white;
          border-radius: 16px;
          padding: 30px;
          max-width: 500px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          animation: slideUp 0.4s ease;
        }

        .modal-content h2 {
          margin: 0 0 20px 0;
          font-size: 20px;
          color: #333;
        }

        .modal-warning {
          background: #fff8f0;
          border-left: 4px solid #FF1493;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .modal-warning p {
          margin: 0 0 10px 0;
          font-size: 13px;
          color: #333;
        }

        .modal-warning ul {
          margin: 0;
          padding: 0 0 0 20px;
          list-style: disc;
        }

        .modal-warning li {
          margin: 5px 0;
          font-size: 13px;
          color: #666;
        }

        .modal-checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 20px;
        }

        .modal-checkbox input[type="checkbox"] {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }

        .modal-checkbox label {
          font-size: 13px;
          cursor: pointer;
          color: #333;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
        }

        @media (max-width: 600px) {
          .onboarding-wrapper {
            max-width: 100%;
            border-radius: 8px;
          }

          .onboarding-content {
            padding: 20px;
          }

          .modal-content {
            padding: 20px;
          }
        }
      `}</style>
    </div>
  );
};

export default Onboarding;
