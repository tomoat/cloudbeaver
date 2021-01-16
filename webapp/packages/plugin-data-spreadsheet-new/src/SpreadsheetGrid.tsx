/*
 * cloudbeaver - Cloud Database Manager
 * Copyright (C) 2020 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0.
 * you may not use this file except in compliance with the License.
 */

import { IDatabaseDataModel } from '@cloudbeaver/plugin-data-viewer';

import { DataGridLoader } from './DataGrid/DataGridLoader';

interface Props {
  model: IDatabaseDataModel<any, any>;
  className?: string;
}

export function SpreadsheetGrid({
  model,
  className,
}: Props) {
  return <DataGridLoader tableModel={model} className={className} />;
}
