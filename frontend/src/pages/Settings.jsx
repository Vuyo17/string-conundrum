import React, { useState } from 'react';
import {
  User, Palette, LogOut, Moon, Sun, Languages, Unlock, Trophy, Pencil, Check, X,
} from 'lucide-react';
import styles from '../styles/App.module.css';
import { ScreenHeader } from '../components/ScreenHeader';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { displayNameFor, initialsFor } from '../utils/profile';

export function Settings({ progress }) {
  const { user, isGuest, signOut, setDisplayName } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { lang, setLang, languages, t } = useLanguage();
  const bypassUnlocks = progress?.bypassUnlocks ?? false;
  const leaderboardOptIn = progress?.leaderboardOptIn ?? true;
  const leaderboardAnonymous = progress?.leaderboardAnonymous ?? false;

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState('');

  // ThemeContext only exposes a toggle, so only flip when the pick differs.
  function chooseTheme(wantDark) {
    if (wantDark !== isDark) toggleTheme();
  }

  function startEditName() {
    // The raw stored value, not displayNameFor's derived/prettified
    // fallback — editing should start from what's actually saved, blank if
    // nothing is, not from a guessed-at email-derived name.
    setNameDraft(user?.displayName ?? '');
    setNameError('');
    setEditingName(true);
  }

  async function saveName() {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setNameError(t('settings.nameRequired'));
      return;
    }
    setSavingName(true);
    setNameError('');
    try {
      await setDisplayName(trimmed);
      setEditingName(false);
    } catch {
      setNameError(t('settings.nameSaveFailed'));
    } finally {
      setSavingName(false);
    }
  }

  return (
    <div className={styles.screenStack}>
      <ScreenHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <section className={styles.card}>
        <div className={styles.settingsSectionTitle}>
          <User size={15} /> {t('settings.profile')}
        </div>
        <div className={styles.settingsProfile}>
          <div className={styles.profileAvatar}>{initialsFor(user)}</div>
          <div>
            {editingName ? (
              <div className={styles.profileNameEdit}>
                <input
                  className={styles.profileNameInput}
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveName();
                    if (e.key === 'Escape') setEditingName(false);
                  }}
                  placeholder={t('settings.namePlaceholder')}
                  maxLength={60}
                  autoFocus
                  disabled={savingName}
                  aria-label={t('settings.editNameLabel')}
                />
                <button
                  type="button"
                  className={styles.profileNameIconBtn}
                  onClick={saveName}
                  disabled={savingName}
                  aria-label={t('common.save')}
                >
                  <Check size={15} />
                </button>
                <button
                  type="button"
                  className={styles.profileNameIconBtn}
                  onClick={() => setEditingName(false)}
                  disabled={savingName}
                  aria-label={t('common.cancel')}
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <div className={styles.profileNameRow}>
                <strong className={styles.settingsProfileName}>{displayNameFor(user)}</strong>
                {!isGuest && (
                  <button
                    type="button"
                    className={styles.profileNameIconBtn}
                    onClick={startEditName}
                    aria-label={t('settings.editName')}
                    title={t('settings.editName')}
                  >
                    <Pencil size={13} />
                  </button>
                )}
              </div>
            )}
            {nameError && <p className={styles.profileNameError}>{nameError}</p>}
            <p className={styles.settingsRowHint}>
              {isGuest ? t('settings.guestHint') : user?.email}
            </p>
          </div>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.settingsSectionTitle}>
          <Palette size={15} /> {t('settings.appearance')}
        </div>
        <div className={styles.settingsRow}>
          <div>
            <strong>{t('settings.theme')}</strong>
            <p className={styles.settingsRowHint}>{t('settings.themeHint')}</p>
          </div>
          <div className={styles.settingsChoice}>
            <button
              type="button"
              className={isDark ? '' : styles.settingsChoiceActive}
              aria-pressed={!isDark}
              onClick={() => chooseTheme(false)}
            >
              <Sun size={14} /> {t('settings.light')}
            </button>
            <button
              type="button"
              className={isDark ? styles.settingsChoiceActive : ''}
              aria-pressed={isDark}
              onClick={() => chooseTheme(true)}
            >
              <Moon size={14} /> {t('settings.dark')}
            </button>
          </div>
        </div>

        <div className={styles.settingsRow}>
          <div>
            <strong>{t('settings.language')}</strong>
            <p className={styles.settingsRowHint}>{t('settings.languageHint')}</p>
          </div>
          <div className={styles.settingsChoice}>
            {languages.map((option) => (
              <button
                key={option.code}
                type="button"
                className={lang === option.code ? styles.settingsChoiceActive : ''}
                aria-pressed={lang === option.code}
                onClick={() => setLang(option.code)}
              >
                <Languages size={14} /> {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {!isGuest && (
        <section className={styles.card}>
          <div className={styles.settingsSectionTitle}>
            <Unlock size={15} /> {t('settings.learning')}
          </div>
          <div className={styles.settingsRow}>
            <div>
              <strong>{t('settings.unlockAll')}</strong>
              <p className={styles.settingsRowHint}>{t('settings.unlockAllHint')}</p>
            </div>
            <div className={styles.settingsChoice}>
              <button
                type="button"
                className={!bypassUnlocks ? styles.settingsChoiceActive : ''}
                aria-pressed={!bypassUnlocks}
                onClick={() => progress?.setBypassUnlocks(false)}
              >
                {t('settings.unlockAllOff')}
              </button>
              <button
                type="button"
                className={bypassUnlocks ? styles.settingsChoiceActive : ''}
                aria-pressed={bypassUnlocks}
                onClick={() => progress?.setBypassUnlocks(true)}
              >
                {t('settings.unlockAllOn')}
              </button>
            </div>
          </div>
        </section>
      )}

      {!isGuest && (
        <section className={styles.card}>
          <div className={styles.settingsSectionTitle}>
            <Trophy size={15} /> {t('settings.leaderboard')}
          </div>
          <div className={styles.settingsRow}>
            <div>
              <strong>{t('settings.leaderboardOptIn')}</strong>
              <p className={styles.settingsRowHint}>{t('settings.leaderboardOptInHint')}</p>
            </div>
            <div className={styles.settingsChoice}>
              <button
                type="button"
                className={!leaderboardOptIn ? styles.settingsChoiceActive : ''}
                aria-pressed={!leaderboardOptIn}
                onClick={() => progress?.setLeaderboardOptIn(false)}
              >
                {t('settings.leaderboardOptInOff')}
              </button>
              <button
                type="button"
                className={leaderboardOptIn ? styles.settingsChoiceActive : ''}
                aria-pressed={leaderboardOptIn}
                onClick={() => progress?.setLeaderboardOptIn(true)}
              >
                {t('settings.leaderboardOptInOn')}
              </button>
            </div>
          </div>

          <div className={styles.settingsRow}>
            <div>
              <strong>{t('settings.leaderboardAnonymous')}</strong>
              <p className={styles.settingsRowHint}>{t('settings.leaderboardAnonymousHint')}</p>
            </div>
            <div className={styles.settingsChoice}>
              <button
                type="button"
                className={!leaderboardAnonymous ? styles.settingsChoiceActive : ''}
                aria-pressed={!leaderboardAnonymous}
                onClick={() => progress?.setLeaderboardAnonymous(false)}
              >
                {t('settings.leaderboardAnonymousOff')}
              </button>
              <button
                type="button"
                className={leaderboardAnonymous ? styles.settingsChoiceActive : ''}
                aria-pressed={leaderboardAnonymous}
                onClick={() => progress?.setLeaderboardAnonymous(true)}
              >
                {t('settings.leaderboardAnonymousOn')}
              </button>
            </div>
          </div>
        </section>
      )}

      <section className={styles.card}>
        <div className={styles.settingsSectionTitle}>
          <LogOut size={15} /> {t('settings.account')}
        </div>
        <div className={styles.settingsRow}>
          <div>
            <strong>{isGuest ? t('nav.signIn') : t('nav.signOut')}</strong>
            <p className={styles.settingsRowHint}>
              {isGuest ? t('settings.signInHint') : t('settings.signOutHint')}
            </p>
          </div>
          <button type="button" className={styles.secondaryButton} onClick={signOut}>
            <LogOut size={14} /> {isGuest ? t('nav.signIn') : t('nav.signOut')}
          </button>
        </div>
      </section>
    </div>
  );
}
