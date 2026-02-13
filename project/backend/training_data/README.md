# Training Data for DTI Business Permit Classifier

## Directory Structure

```
training_data/
├── authentic/          ← Place your REAL DTI permit images here
│   ├── permit1.jpg
│   ├── permit2.png
│   └── ...
├── non_permit/         ← Place random NON-permit images here (optional)
│   ├── selfie.jpg
│   ├── landscape.png
│   └── ...
└── augmented/          ← Auto-generated (created during training)
    ├── authentic/
    └── non_permit/
```

## How to Use

### Step 1: Add Authentic Permit Images

Place your **DTI Business Permit** photos in `training_data/authentic/`.

Even **1 image** works — the system will generate 30+ augmented variants
(rotated, cropped, brightness-adjusted, etc.) to build a training set.

The more real permit images you add, the better the model will perform.

### Step 2: Add Non-Permit Images (Optional)

Place random images that are NOT permits in `training_data/non_permit/`.
Examples: selfies, food photos, landscapes, screenshots, etc.

If you skip this step, the training script will auto-generate synthetic
negative images (solid colours, noise, gradients, shapes).

### Step 3: Train the Model

```bash
cd project/backend
python train_permit_model.py
```

Or to auto-generate negatives:
```bash
python train_permit_model.py --generate-negatives
```

### Step 4: Done!

The trained model is saved to `ml_models/permit_classifier.pkl` and will
be loaded automatically when the Flask server starts.

## Augmentation Options

```bash
# More augmented copies per image (default: 30)
python train_permit_model.py --augment-count 50

# More synthetic negatives (default: 60)
python train_permit_model.py --generate-negatives --neg-count 100
```

## Image Formats Supported

JPG, JPEG, PNG, BMP, WEBP
