//somehow this plugin may cause koishi delete koishi.yml
//so make a backup
import * as fs from 'fs';
import * as yaml from 'js-yaml';

export function backupYamlFile(filePath: string, backupFilePath: string): void {
  try {
    const yamlData = fs.readFileSync(filePath, 'utf8');
    const parsedYaml = yaml.load(yamlData);
    const serializedYaml = yaml.dump(parsedYaml);
    fs.writeFileSync(backupFilePath, serializedYaml, 'utf8');
    console.log('YAML file has been successfully backed up.');
  } catch (error) {
    console.error('Error while backing up YAML file:', error);
  }
}

