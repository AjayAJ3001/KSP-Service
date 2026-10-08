import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

export async function exportCSV(filename: string, headers: string[], rows: (string | number | undefined | null)[][]): Promise<void> {
  try {
    const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))];
    const csvContent = '\uFEFF' + lines.join('\r\n');

    const cleanFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    const fileUri = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}${cleanFilename}`;

    await FileSystem.writeAsStringAsync(fileUri, csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: `Download / Share ${cleanFilename}`,
        UTI: 'public.comma-separated-values-text',
      });
    } else {
      Alert.alert('Saved', `CSV file saved to ${fileUri}`);
    }
  } catch (error: any) {
    console.error('Error exporting CSV:', error);
    Alert.alert('Export Failed', error.message || 'Could not export file.');
  }
}
