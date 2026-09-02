"""
Retrain the SOH/capacity model on the real NASA Li-ion discharge dataset.

The model.joblib shipped in this repo was pickled with scikit-learn 0.22.2
(2019-era). Modern scikit-learn (>=1.0) changed the internal binary layout of
its Cython Tree structs, so that old pickle cannot be unpickled anymore:

    ValueError: node array from the pickle has an incompatible dtype

Rather than fighting dependency archaeology, this script reproduces the
original feature engineering used in app.py (time to reach the discharge
voltage cutoff, time to reach peak temperature -> discharged capacity) and
refits a RandomForestRegressor on the same discharge.csv data, so we end up
with a real model trained on real cycling data that loads cleanly in the
current environment.

Usage:
    venv\\Scripts\\python.exe train_model.py
"""
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import mean_absolute_error, r2_score
from joblib import dump

# End-of-discharge voltage cutoff used by NASA for each cell (see app.py).
MAX_VOLT = {'B0005': 2.7, 'B0006': 2.5, 'B0007': 2.2, 'B0018': 2.5}


def build_features(df_discharge: pd.DataFrame) -> pd.DataFrame:
    """Per (battery, cycle): time to hit the voltage cutoff, time to hit peak
    temperature, and the resulting discharged capacity. Mirrors app.py's
    load_features(), but avoids the removed DataFrame.append API."""
    rows = []
    groups = df_discharge[['id_cycle', 'Battery']].drop_duplicates().apply(tuple, axis=1)
    for id_cycle, battery in groups:
        mask = (df_discharge.id_cycle == id_cycle) & (df_discharge.Battery == battery)
        df_tmp = df_discharge[mask].sort_values('Time')
        t_0 = df_tmp['Time'].min()
        t_volt = df_tmp.loc[df_tmp['Voltage_measured'] <= MAX_VOLT[battery], 'Time'].min()
        t_tmax = df_tmp.loc[df_tmp['Temperature_measured'] == df_tmp['Temperature_measured'].max(), 'Time'].min()
        capacity = df_tmp['Capacity'].max()
        rows.append({
            'Battery': battery,
            'id_cycle': id_cycle,
            'time_volt': t_volt - t_0,
            'time_temp': t_tmax - t_0,
            'capacity': capacity,
        })
    return pd.DataFrame(rows)


def main():
    df = pd.read_csv('discharge.csv')
    features = build_features(df).dropna()
    print(f"Built {len(features)} (cycle, battery) feature rows from {df['Battery'].nunique()} batteries")

    X = features[['time_volt', 'time_temp']]
    y = features['capacity']

    # Split by battery so evaluation reflects generalization to an unseen cell,
    # not just interpolation between cycles of the same battery.
    splitter = GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=42)
    train_idx, test_idx = next(splitter.split(X, y, groups=features['Battery']))
    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

    model = RandomForestRegressor(n_estimators=300, max_depth=8, min_samples_leaf=3, random_state=42)
    model.fit(X_train, y_train)

    pred = model.predict(X_test)
    print(f"Held-out batteries: {sorted(features['Battery'].iloc[test_idx].unique())}")
    print(f"MAE:  {mean_absolute_error(y_test, pred):.4f} Ah")
    print(f"R^2:  {r2_score(y_test, pred):.4f}")

    # Refit on all data for the shipped artifact.
    final_model = RandomForestRegressor(n_estimators=300, max_depth=8, min_samples_leaf=3, random_state=42)
    final_model.fit(X, y)

    dump(final_model, 'model.joblib')
    print("Saved retrained model -> model.joblib")


if __name__ == '__main__':
    main()
