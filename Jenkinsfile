pipeline {
  agent any
  stages {
    stage('Backend Tests') {
      steps {
        sh '''
          cd backend
          python3 -m venv .venv
          . .venv/bin/activate
          pip install -r requirements.txt
          pytest -q
        '''
      }
    }
    stage('Frontend Typecheck & Build') {
      steps {
        sh '''
          cd frontend
          npm ci
          npx vue-tsc --noEmit
          npm test
          npm run build
        '''
      }
    }
    stage('Deploy Stack') {
      steps {
        sh 'chmod +x deploy/deploy.sh && ./deploy/deploy.sh'
      }
    }
  }
}
