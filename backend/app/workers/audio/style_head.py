import os
import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.preprocessing import StandardScaler

class ClassificationHead:
    """
    The 'Head' of the model. 
    It sits on top of the MusiCNN 'Backbone' (Embedding Extractor).
    It learns to map Embeddings -> Folk Styles based on user feedback.
    """
    
    def __init__(self, model_dir: str = "models"):
        self.model_path = os.path.join(model_dir, "custom_style_head.pkl")
        self.scaler = None
        self.model = None
        self._load()

    def _load(self):
        if os.path.exists(self.model_path):
            data = joblib.load(self.model_path)
            self.model = data['model']
            self.scaler = data['scaler']
            print("🧠 Classification Head loaded.")
        else:
            print("🌱 New Classification Head initialized (Waiting for training data).")

    def predict(self, embedding: list) -> str:
        """
        Returns the predicted style string (e.g., 'Hambo') or 'Unknown'.
        """
        if self.model is None or self.scaler is None:
            return "Unknown"
        
        try:
            # --- SAFETY CHECK FOR HYBRID UPDATE ---
            # The model expects a specific number of features.
            expected_features = self.scaler.n_features_in_
            if len(embedding) > expected_features:
                embedding = embedding[:expected_features]
            elif len(embedding) < expected_features:
                 return "Unknown"

            # 1. Normalize
            scaled_features = self.scaler.transform([embedding])
            
            # 2. Predict
            probs = self.model.predict_proba(scaled_features)
            max_prob = np.max(probs)
            
            if max_prob < 0.4: 
                return "Unknown"
                
            prediction_idx = np.argmax(probs)
            return self.model.classes_[prediction_idx]
        except Exception as e:
            print(f"⚠️ Head prediction failed: {e}")
            return "Unknown"
    def train(self, embeddings: list, labels: list):
        """
        Retrains the head using the provided Golden Dataset.
        """
        if not embeddings or not labels:
            print("⚠️ No data to train on.")
            return

        print(f"💪 Training Head on {len(labels)} examples...")
        
        X = np.array(embeddings)
        y = np.array(labels)

        # 1. Normalize
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)

        # 2. Fit Model
        # RandomForest is robust against noise and works well with embeddings
        self.model = RandomForestClassifier(n_estimators=100, random_state=42)
        self.model.fit(X_scaled, y)

        # 3. Save
        joblib.dump({'model': self.model, 'scaler': self.scaler}, self.model_path)
        print("✅ Classification Head saved to disk.")