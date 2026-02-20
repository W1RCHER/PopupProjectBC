import json
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

X = [
    {"length": 500, "evalCount": 1, "obfuscationRate": 5, "urlCount": 0, "base64": 0, "crypto": 0, "iframe": 0, "htmlInjection": 1},
    {"length": 8000, "evalCount": 20, "obfuscationRate": 100, "urlCount": 5, "base64": 1, "crypto": 1, "iframe": 1, "htmlInjection": 1},
]
y = [0, 1]

features = ["length", "evalCount", "obfuscationRate", "urlCount", "base64", "crypto", "iframe", "htmlInjection"]

X_matrix = np.array([[row[f] for f in features] for row in X], dtype=float)

scaler = StandardScaler()
X_scaled = scaler.fit_transform(X_matrix)


model = LogisticRegression(max_iter=500)
model.fit(X_scaled, y)


weights = {
    "bias": float(model.intercept_[0]),
    "weights": {},
    "scaler_mean": scaler.mean_.tolist(),
    "scaler_scale": scaler.scale_.tolist()
}

for i, f in enumerate(features):
    weights["weights"][f] = float(model.coef_[0][i])

with open("ml_weights.json", "w") as f:
    json.dump(weights, f, indent=2)

print("Готово! ml_weights.json создан.")
