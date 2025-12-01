import { useCreateStyles } from 'simplestyle-js/react';

export function BenTestComponent() {
  const classes = useCreateStyles({
    root: {
      backgroundColor: 'pink',
      color: 'purple',

      '& > h1': {
        fontSize: '4rem',
      },
    },
  });

  return (
    <div className={classes.root}>
      <h1>This is just a Ben test component</h1>
      <button type="button">
        Stuff and things
      </button>
    </div>
  );
}