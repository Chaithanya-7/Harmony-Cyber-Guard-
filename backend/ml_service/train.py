import torch
from transformers import (
    AutoTokenizer, 
    AutoModelForSequenceClassification, 
    Trainer, 
    TrainingArguments,
    DataCollatorWithPadding
)
from datasets import Dataset
import pandas as pd
import os
import pickle
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from xgboost import XGBClassifier

# Example labels mapping
LABEL_MAP = {
    "safe": 0,
    "scam": 1,
    "harassment": 2,
    "threat": 3,
    "pii_request": 4
}

CALLER_LABEL_MAP = {
    "safe": 0,
    "risky": 1,
}

def train_modern_bert(data_path: str, output_dir: str = "./model_output"):
    """
    Fine-tunes ModernBERT on a provided CSV/JSON dataset.
    Dataset columns expected: 'text', 'label'
    """
    print(f"[Training] Loading dataset from {data_path}...")
    
    # Load data
    if data_path.endswith('.csv'):
        df = pd.read_csv(data_path)
    else:
        df = pd.read_json(data_path)

    # Convert labels to IDs
    df['label'] = df['label'].map(LABEL_MAP)
    
    # Initialize tokenizer
    model_id = "answerdotai/ModernBERT-base"
    tokenizer = AutoTokenizer.from_pretrained(model_id)

    # Prepare dataset
    dataset = Dataset.from_pandas(df)
    
    def tokenize_function(examples):
        return tokenizer(examples["text"], truncation=True, padding="max_length", max_length=512)

    tokenized_dataset = dataset.map(tokenize_function, batched=True)
    tokenized_dataset = tokenized_dataset.train_test_split(test_size=0.1)

    # Load model
    model = AutoModelForSequenceClassification.from_pretrained(
        model_id, 
        num_labels=len(LABEL_MAP)
    )

    # Training arguments optimized for ModernBERT
    training_args = TrainingArguments(
        output_dir=output_dir,
        learning_rate=2e-5,
        per_device_train_batch_size=16,
        per_device_eval_batch_size=16,
        num_train_epochs=3,
        weight_decay=0.01,
        evaluation_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        fp16=True, # Use half-precision if supported
        push_to_hub=False,
        report_to="none"
    )

    # Initialize Trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_dataset["train"],
        eval_dataset=tokenized_dataset["test"],
        tokenizer=tokenizer,
        data_collator=DataCollatorWithPadding(tokenizer=tokenizer),
    )

    print("[Training] Starting fine-tuning...")
    trainer.train()
    
    print(f"[Training] Saving model to {output_dir}...")
    trainer.save_model(output_dir)
    tokenizer.save_pretrained(output_dir)

def train_caller_xgboost(data_path: str, output_path: str = "./caller_risk_model.pkl"):
    """
    Trains a caller-risk model from structured data.
    Expected columns:
    - is_voip
    - has_repeated_digits
    - total_calls
    - average_prior_risk
    - blocked_ratio
    - masked_location
    - digits_length
    - label ('safe' | 'risky')
    """
    print(f"[Training] Loading caller dataset from {data_path}...")
    if data_path.endswith(".csv"):
        df = pd.read_csv(data_path)
    else:
        df = pd.read_json(data_path)

    df["label"] = df["label"].map(CALLER_LABEL_MAP)
    feature_columns = [
        "is_voip",
        "has_repeated_digits",
        "total_calls",
        "average_prior_risk",
        "blocked_ratio",
        "masked_location",
        "digits_length",
    ]

    X = df[feature_columns]
    y = df["label"]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    model = XGBClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        objective="binary:logistic",
        eval_metric="logloss",
    )
    model.fit(X_train, y_train)

    predictions = model.predict(X_test)
    print("[Training] Caller model evaluation:")
    print(classification_report(y_test, predictions, digits=3))

    with open(output_path, "wb") as model_file:
        pickle.dump(model, model_file)

    print(f"[Training] Saved caller-risk model to {output_path}")

if __name__ == "__main__":
    # Example usage
    # train_modern_bert("scam_dataset.csv")
    # train_caller_xgboost("caller_dataset.csv")
    pass
