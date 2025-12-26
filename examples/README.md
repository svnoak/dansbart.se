# Dansbart Dataset Examples

This directory contains example scripts and notebooks for working with the Dansbart open dataset.

## Download Script

### download_dataset.py

A Python script for downloading the complete Dansbart dataset.

**Installation:**
```bash
pip install requests
```

**Basic Usage:**
```bash
# Download the full dataset
python download_dataset.py

# Download only feedback data
python download_dataset.py --feedback-only

# Customize batch size and output directory
python download_dataset.py --batch-size 500 --output-dir ./my_data

# Use local development server
python download_dataset.py --base-url http://localhost:8000/api
```

**Options:**
- `--batch-size` - Number of tracks per batch (default: 1000)
- `--output-dir` - Output directory (default: ./dansbart_data)
- `--feedback-only` - Download only feedback data
- `--base-url` - API base URL (default: https://dansbart.se/api)

**Output Structure:**
```
dansbart_data/
├── batch_1.json           # First batch of tracks
├── batch_2.json           # Second batch of tracks
├── ...
├── complete_dataset.json  # Full dataset with metadata
└── feedback_data.json     # Human feedback and ground truth
```

## Future Examples

Additional examples to be added:

- `train_classifier.ipynb` - Jupyter notebook showing how to train a dance style classifier
- `analyze_features.ipynb` - Notebook for analyzing audio feature distributions
- `validate_model.py` - Script for validating models against ground truth data
- `export_csv.py` - Convert JSON dataset to CSV format for non-Python tools

## Contributing

If you've built something useful with the Dansbart dataset, consider contributing your example back to this directory!
