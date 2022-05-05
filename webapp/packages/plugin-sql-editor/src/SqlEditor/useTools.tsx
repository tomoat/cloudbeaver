/*
 * CloudBeaver - Cloud Database Manager
 * Copyright (C) 2020-2022 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0.
 * you may not use this file except in compliance with the License.
 */

import { action } from 'mobx';

import { useObservableRef } from '@cloudbeaver/core-blocks';
import { ConnectionInfoResource } from '@cloudbeaver/core-connections';
import { useService } from '@cloudbeaver/core-di';
import { CommonDialogService, DialogueStateResult } from '@cloudbeaver/core-dialogs';
import { NotificationService } from '@cloudbeaver/core-events';
import { download, generateFileName, getTextFileReadingProcess } from '@cloudbeaver/core-utils';
import { ResourceManagerService, SaveScriptDialog, ScriptsManagerService } from '@cloudbeaver/plugin-resource-manager';
import { SqlEditorTabService } from '@cloudbeaver/plugin-sql-editor-navigation-tab';

import { getSqlEditorName } from '../getSqlEditorName';
import type { ISqlEditorTabState } from '../ISqlEditorTabState';
import { SqlEditorService } from '../SqlEditorService';
import { SqlEditorSettingsService } from '../SqlEditorSettingsService';
import { ScriptImportDialog } from './ScriptImportDialog';

interface State {
  tryReadScript: (file: File, prevScript: string) => Promise<string | null>;
  readScript: (file: File) => Promise<string | null>;
  downloadScript: (script: string) => void;
  saveScript: (script: string) => void;
  updateAssociatedScript: (scriptId: string, value: string) => void;
  checkFileValidity: (file: File) => boolean;
}

export function useTools(state: ISqlEditorTabState): Readonly<State> {
  const commonDialogService = useService(CommonDialogService);
  const notificationService = useService(NotificationService);
  const connectionInfoResource = useService(ConnectionInfoResource);
  const sqlEditorSettingsService = useService(SqlEditorSettingsService);
  const scriptsManagerService = useService(ScriptsManagerService);
  const resourceManagerService = useService(ResourceManagerService);
  const sqlEditorService = useService(SqlEditorService);
  const sqlEditorTabService = useService(SqlEditorTabService);

  return useObservableRef(() => ({
    async tryReadScript(file: File, prevScript: string) {
      const valid = this.checkFileValidity(file);

      if (!valid) {
        return null;
      }

      if (prevScript) {
        const result = await this.commonDialogService.open(ScriptImportDialog, null);

        if (result === DialogueStateResult.Rejected) {
          return null;
        }

        if (result !== DialogueStateResult.Resolved && result) {
          this.downloadScript(prevScript);
        }
      }

      return this.readScript(file);
    },

    async readScript(file: File) {
      let script = null;
      try {
        const process = getTextFileReadingProcess(file);
        script = await process.promise;
      } catch (exception: any) {
        this.notificationService.logException(exception, 'Uploading script error');
      }

      return script;
    },

    checkFileValidity(file: File) {
      const maxSize = this.sqlEditorSettingsService.settings.getValue('maxFileSize');
      const size = Math.round(file.size / 1000); // kilobyte
      const aboveMaxSize = size > maxSize;

      if (aboveMaxSize) {
        this.notificationService.logInfo({
          title: 'sql_editor_upload_script_max_size_title',
          message: `Max size: ${maxSize}KB\nFile size: ${size}KB`,
          persistent: true,
        });

        return false;
      }

      return true;
    },

    downloadScript(script: string) {
      if (!script.trim()) {
        return;
      }

      const blob = new Blob([script], {
        type: 'application/sql',
      });

      const connection = this.connectionInfoResource.get(this.state.executionContext?.connectionId ?? '');
      const name = getSqlEditorName(this.state, connection);

      download(blob, generateFileName(name, '.sql'));
    },
    async updateAssociatedScript(scriptId: string, value: string) {
      try {
        const node = await this.scriptsManagerService.writeScript(scriptId, value);
        this.notificationService.logSuccess({ title: 'plugin_resource_manager_update_script_success', message: node.name });
      } catch (exception) {
        this.notificationService.logException(exception as any, 'plugin_resource_manager_update_script_error');
      }
    },
    async saveScript(script: string) {
      if (this.state.associatedScriptId) {
        await this.updateAssociatedScript(this.state.associatedScriptId, script);
        return;
      }

      const tabName = this.sqlEditorTabService.getName(this.state);
      const name = await this.commonDialogService.open(SaveScriptDialog, {
        defaultScriptName: tabName,
      });

      if (name != DialogueStateResult.Rejected && name !== DialogueStateResult.Resolved) {
        try {
          const node = await this.scriptsManagerService.saveScript(name.trim(), script);
          this.sqlEditorService.setAssociatedScriptId(node.id, this.state);
          this.sqlEditorService.setName(node.name ?? name, this.state);

          this.notificationService.logSuccess({ title: 'plugin_resource_manager_save_script_success', message: node.name });

          if (!this.resourceManagerService.enabled) {
            this.resourceManagerService.toggleEnabled();
          }

        } catch (exception) {
          this.notificationService.logException(exception as any, 'plugin_resource_manager_save_script_error');
        }
      }
    },
  }),
    {
      tryReadScript: action.bound,
      readScript: action.bound,
      checkFileValidity: action.bound,
      downloadScript: action.bound,
      saveScript: action.bound,
    },
    {
      commonDialogService,
      connectionInfoResource,
      notificationService,
      sqlEditorSettingsService,
      scriptsManagerService,
      sqlEditorService,
      sqlEditorTabService,
      resourceManagerService,
      state,
    });
}
