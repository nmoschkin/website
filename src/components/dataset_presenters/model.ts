import { StrictGridProps, StrictTableProps } from 'semantic-ui-react';

export interface IEssentialData {
	id: number;
	name: string;
};

export interface IDataGridSetup {
	gridProps?: StrictGridProps;
	renderGridColumn?: (datum: IEssentialData, isSelected: boolean) => JSX.Element;
	defaultSort?: IDataSortField;
};

export interface IDataTableSetup {
	tableProps?: StrictTableProps;
	columns: IDataTableColumn[];
	rowsPerPage?: number;
	defaultSort?: IDataSortField;
};

export interface IDataTableColumn {
	id: string;
	title: string | JSX.Element;
	align?: 'left' | 'right' | 'center';
	sortField?: IDataSortField;
	renderCell: (datum: IEssentialData, isSelected: boolean) => JSX.Element;
};

export interface IDataSortField {
	id: string;
	firstSort?: 'ascending' | 'descending';
	stringValue?: boolean;
	customSort?: (a: IEssentialData, b: IEssentialData, sortDirection: 'ascending' | 'descending') => number;
};

export interface IDataPickerState {
	pendingSelectedIds: Set<number>;
	setPendingSelectedIds: (pendingSelectedIds: Set<number>) => void;
	searchQuery: string;
	setSearchQuery: (searchQuery: string) => void;
	showOptions: boolean;
	setShowOptions: (showOptions: boolean) => void;
	layout: 'grid' | 'table';
	setLayout: (layout: 'grid' | 'table') => void;
};